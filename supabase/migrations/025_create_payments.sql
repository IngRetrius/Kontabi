-- 025_create_payments.sql
-- Payment records and application to invoices.
-- Links the financial transaction (journal entry) with invoice settlement.

-- =============================================
-- TABLE: payments
-- =============================================

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('transfer', 'deposit', 'cash', 'other')),
  reference TEXT,
  receipt_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payments IS 'Pagos registrados contra cobros de unidades. Cada pago genera un asiento contable via transaccion.';
COMMENT ON COLUMN public.payments.payment_method IS 'Metodo de pago: transfer=transferencia, deposit=consignacion, cash=efectivo, other=otro.';
COMMENT ON COLUMN public.payments.receipt_url IS 'URL del comprobante subido a Supabase Storage.';
COMMENT ON COLUMN public.payments.transaction_id IS 'Referencia a la transaccion contable generada automaticamente.';

CREATE INDEX idx_payments_tenant ON public.payments (tenant_id);
CREATE INDEX idx_payments_unit ON public.payments (unit_id);
CREATE INDEX idx_payments_date ON public.payments (tenant_id, payment_date DESC);
CREATE INDEX idx_payments_transaction ON public.payments (transaction_id) WHERE transaction_id IS NOT NULL;

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payments in their tenant"
  ON public.payments FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert payments in their tenant"
  ON public.payments FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update payments in their tenant"
  ON public.payments FOR UPDATE
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can delete payments in their tenant"
  ON public.payments FOR DELETE
  USING (tenant_id = public.get_current_tenant_id());

-- Audit
CREATE TRIGGER trg_payments_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =============================================
-- TABLE: payment_applications
-- Links payments to invoices (one payment can apply to multiple invoices).
-- =============================================

CREATE TABLE IF NOT EXISTS public.payment_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  amount_applied NUMERIC(14,2) NOT NULL CHECK (amount_applied > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payment_applications IS 'Aplicacion de pagos a cobros. Un pago puede distribuirse entre multiples cobros.';

CREATE INDEX idx_payment_applications_tenant ON public.payment_applications (tenant_id);
CREATE INDEX idx_payment_applications_payment ON public.payment_applications (payment_id);
CREATE INDEX idx_payment_applications_invoice ON public.payment_applications (invoice_id);

-- RLS
ALTER TABLE public.payment_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payment_applications in their tenant"
  ON public.payment_applications FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert payment_applications in their tenant"
  ON public.payment_applications FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can delete payment_applications in their tenant"
  ON public.payment_applications FOR DELETE
  USING (tenant_id = public.get_current_tenant_id());

-- =============================================
-- FUNCTION: mark_overdue_invoices
-- Marks pending/partial invoices as overdue when past due date.
-- =============================================

CREATE OR REPLACE FUNCTION public.mark_overdue_invoices()
RETURNS INTEGER AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE public.invoices
  SET status = 'overdue'
  WHERE status IN ('pending', 'partial')
    AND due_date < CURRENT_DATE
    AND tenant_id = public.get_current_tenant_id();

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.mark_overdue_invoices IS 'Marca cobros vencidos automaticamente. Retorna el numero de cobros actualizados.';

-- =============================================
-- FUNCTION: calculate_late_interest
-- Calculates late interest for overdue invoices of a tenant.
-- Uses tenant_settings for rate, type, and grace period.
-- Returns a table of invoices with calculated interest amounts.
-- =============================================

CREATE OR REPLACE FUNCTION public.calculate_late_interest(
  p_period TEXT DEFAULT NULL
)
RETURNS TABLE (
  invoice_id UUID,
  unit_id UUID,
  period TEXT,
  days_overdue INTEGER,
  outstanding NUMERIC(14,2),
  interest_amount NUMERIC(14,2)
) AS $$
DECLARE
  v_tenant_id UUID;
  v_rate NUMERIC(10,6);
  v_grace_days INTEGER;
  v_compound BOOLEAN;
BEGIN
  v_tenant_id := public.get_current_tenant_id();

  -- Read tenant config from individual key-value settings
  -- (defaults: 1.5% monthly simple, 5 days grace)
  SELECT COALESCE(ts.value::NUMERIC, 0.015)
  INTO v_rate
  FROM public.tenant_settings ts
  WHERE ts.tenant_id = v_tenant_id AND ts.key = 'late_fee_rate';
  IF v_rate IS NULL THEN v_rate := 0.015; END IF;

  SELECT COALESCE(ts.value::INTEGER, 5)
  INTO v_grace_days
  FROM public.tenant_settings ts
  WHERE ts.tenant_id = v_tenant_id AND ts.key = 'grace_period_days';
  IF v_grace_days IS NULL THEN v_grace_days := 5; END IF;

  SELECT COALESCE(ts.value = 'compound', FALSE)
  INTO v_compound
  FROM public.tenant_settings ts
  WHERE ts.tenant_id = v_tenant_id AND ts.key = 'late_fee_type';
  IF v_compound IS NULL THEN v_compound := FALSE; END IF;

  RETURN QUERY
  SELECT
    i.id AS invoice_id,
    i.unit_id,
    i.period,
    (CURRENT_DATE - i.due_date - v_grace_days)::INTEGER AS days_overdue,
    (i.total - i.paid_amount) AS outstanding,
    CASE
      WHEN (CURRENT_DATE - i.due_date) <= v_grace_days THEN 0::NUMERIC(14,2)
      WHEN v_compound THEN
        ROUND(
          (i.total - i.paid_amount) * (POWER(1 + v_rate, CEIL((CURRENT_DATE - i.due_date - v_grace_days)::NUMERIC / 30)) - 1),
          2
        )::NUMERIC(14,2)
      ELSE
        ROUND(
          (i.total - i.paid_amount) * v_rate * CEIL((CURRENT_DATE - i.due_date - v_grace_days)::NUMERIC / 30),
          2
        )::NUMERIC(14,2)
    END AS interest_amount
  FROM public.invoices i
  WHERE i.tenant_id = v_tenant_id
    AND i.status IN ('overdue', 'partial')
    AND i.due_date < CURRENT_DATE
    AND (i.total - i.paid_amount) > 0
    AND (p_period IS NULL OR i.period = p_period);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.calculate_late_interest IS 'Calcula intereses de mora para cobros vencidos. Soporta interes simple y compuesto con periodo de gracia configurable.';
