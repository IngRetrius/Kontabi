-- 006_create_transactions.sql
-- Financial transactions: every money movement in the condominium.
-- Each transaction generates a journal entry automatically (via application layer).

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'quota_payment', 'extraordinary_payment', 'supplier_payment',
    'utility_payment', 'payroll', 'reserve_fund_contribution',
    'late_interest', 'common_area_rental', 'bank_fee', 'depreciation',
    'insurance', 'maintenance', 'security', 'cleaning', 'legal',
    'admin_expense', 'other_income', 'other_expense', 'adjustment'
  )),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  unit_id UUID REFERENCES public.units(id) ON DELETE SET NULL,
  journal_entry_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  narratives JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.transactions IS 'Transacciones financieras del conjunto. Cada transaccion genera un asiento contable automatico.';
COMMENT ON COLUMN public.transactions.type IS 'Tipo de operacion: determina las cuentas contables afectadas via mappings.';
COMMENT ON COLUMN public.transactions.amount IS 'Monto positivo de la transaccion en COP.';
COMMENT ON COLUMN public.transactions.unit_id IS 'Unidad asociada (para pagos de cuotas, intereses de mora, etc.). NULL para gastos generales.';
COMMENT ON COLUMN public.transactions.journal_entry_id IS 'Referencia al asiento contable generado. Se llena despues de crear el asiento.';
COMMENT ON COLUMN public.transactions.metadata IS 'Datos adicionales: supplier, method, reference, period, etc.';
COMMENT ON COLUMN public.transactions.narratives IS 'Narrativas NLS en 3 niveles: {summary, detail, accounting}.';

-- Indexes
CREATE INDEX idx_transactions_tenant_id ON public.transactions (tenant_id);
CREATE INDEX idx_transactions_date ON public.transactions (tenant_id, date DESC);
CREATE INDEX idx_transactions_type ON public.transactions (tenant_id, type);
CREATE INDEX idx_transactions_unit ON public.transactions (unit_id) WHERE unit_id IS NOT NULL;
CREATE INDEX idx_transactions_journal ON public.transactions (journal_entry_id) WHERE journal_entry_id IS NOT NULL;

-- Auto-update
CREATE TRIGGER trg_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view transactions in their tenant"
  ON public.transactions FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert transactions in their tenant"
  ON public.transactions FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update transactions in their tenant"
  ON public.transactions FOR UPDATE
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can delete transactions in their tenant"
  ON public.transactions FOR DELETE
  USING (tenant_id = public.get_current_tenant_id());

-- Audit
CREATE TRIGGER trg_transactions_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
