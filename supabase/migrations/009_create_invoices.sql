-- 009_create_invoices.sql
-- Monthly invoices (cobros) generated from the active budget.
-- Each invoice corresponds to one unit for one billing period.

-- =============================================
-- TABLE: invoices
-- =============================================

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  budget_id UUID REFERENCES public.budgets(id) ON DELETE SET NULL,
  period TEXT NOT NULL CHECK (period ~ '^\d{4}-\d{2}$'),
  quota_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (quota_amount >= 0),
  extraordinary_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (extraordinary_amount >= 0),
  late_fee_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (late_fee_amount >= 0),
  total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  paid_date DATE,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, unit_id, period)
);

COMMENT ON TABLE public.invoices IS 'Cobros mensuales por unidad. Generados masivamente desde el presupuesto vigente.';
COMMENT ON COLUMN public.invoices.period IS 'Periodo de facturacion en formato YYYY-MM.';
COMMENT ON COLUMN public.invoices.quota_amount IS 'Monto de cuota ordinaria calculado por coeficiente.';
COMMENT ON COLUMN public.invoices.extraordinary_amount IS 'Monto de cuotas extraordinarias activas para el periodo.';
COMMENT ON COLUMN public.invoices.late_fee_amount IS 'Intereses de mora acumulados.';
COMMENT ON COLUMN public.invoices.total IS 'Total = cuota + extraordinario + mora.';

CREATE INDEX idx_invoices_tenant ON public.invoices (tenant_id);
CREATE INDEX idx_invoices_unit ON public.invoices (unit_id);
CREATE INDEX idx_invoices_period ON public.invoices (tenant_id, period DESC);
CREATE INDEX idx_invoices_status ON public.invoices (tenant_id, status);
CREATE INDEX idx_invoices_due_date ON public.invoices (tenant_id, due_date) WHERE status IN ('pending', 'partial');
CREATE INDEX idx_invoices_budget ON public.invoices (budget_id) WHERE budget_id IS NOT NULL;

-- Auto-update
CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invoices in their tenant"
  ON public.invoices FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert invoices in their tenant"
  ON public.invoices FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update invoices in their tenant"
  ON public.invoices FOR UPDATE
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can delete pending invoices in their tenant"
  ON public.invoices FOR DELETE
  USING (tenant_id = public.get_current_tenant_id() AND status = 'pending');

-- Audit
CREATE TRIGGER trg_invoices_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =============================================
-- FUNCTION: calculate_invoice_total
-- Auto-calculates total when amounts change.
-- =============================================

CREATE OR REPLACE FUNCTION public.calculate_invoice_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total := NEW.quota_amount + NEW.extraordinary_amount + NEW.late_fee_amount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_invoice_total
  BEFORE INSERT OR UPDATE OF quota_amount, extraordinary_amount, late_fee_amount
  ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.calculate_invoice_total();

COMMENT ON FUNCTION public.calculate_invoice_total IS 'Calcula el total del cobro automaticamente.';

-- =============================================
-- FUNCTION: update_invoice_status_on_payment
-- Updates status based on paid_amount vs total.
-- =============================================

CREATE OR REPLACE FUNCTION public.update_invoice_status_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.paid_amount >= NEW.total AND NEW.total > 0 THEN
    NEW.status := 'paid';
    NEW.paid_date := COALESCE(NEW.paid_date, CURRENT_DATE);
  ELSIF NEW.paid_amount > 0 AND NEW.paid_amount < NEW.total THEN
    NEW.status := 'partial';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_invoice_status
  BEFORE UPDATE OF paid_amount ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_invoice_status_on_payment();

COMMENT ON FUNCTION public.update_invoice_status_on_payment IS 'Actualiza el estado del cobro al registrar pagos.';
