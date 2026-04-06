-- 008_create_budgets.sql
-- Annual budgets and budget line items for residential buildings (PH).
-- Each budget links items to the chart of accounts for execution tracking.

-- =============================================
-- TABLE: budgets
-- =============================================

CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year >= 2020 AND year <= 2099),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'active')),
  total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  reserve_fund_pct NUMERIC(5,2) NOT NULL DEFAULT 1.00 CHECK (reserve_fund_pct >= 0 AND reserve_fund_pct <= 100),
  notes TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.budgets IS 'Presupuesto anual de propiedad horizontal. Solo uno puede estar activo por ano y tenant.';
COMMENT ON COLUMN public.budgets.status IS 'draft = en edicion, approved = aprobado por asamblea, active = vigente para facturacion.';
COMMENT ON COLUMN public.budgets.reserve_fund_pct IS 'Porcentaje del presupuesto destinado al fondo de reserva (Art. 35 Ley 675).';

-- Only one active budget per year per tenant
CREATE UNIQUE INDEX idx_budgets_active_per_year
  ON public.budgets (tenant_id, year)
  WHERE status = 'active';

CREATE INDEX idx_budgets_tenant_id ON public.budgets (tenant_id);
CREATE INDEX idx_budgets_year ON public.budgets (tenant_id, year DESC);
CREATE INDEX idx_budgets_status ON public.budgets (tenant_id, status);

-- Auto-update
CREATE TRIGGER trg_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view budgets in their tenant"
  ON public.budgets FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert budgets in their tenant"
  ON public.budgets FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update budgets in their tenant"
  ON public.budgets FOR UPDATE
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can delete draft budgets in their tenant"
  ON public.budgets FOR DELETE
  USING (tenant_id = public.get_current_tenant_id() AND status = 'draft');

-- Audit
CREATE TRIGGER trg_budgets_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =============================================
-- TABLE: budget_items
-- =============================================

CREATE TABLE IF NOT EXISTS public.budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'payroll', 'security', 'cleaning', 'maintenance',
    'utilities', 'insurance', 'admin', 'legal', 'reserve_fund', 'other'
  )),
  monthly_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (monthly_amount >= 0),
  annual_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (annual_amount >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.budget_items IS 'Rubros del presupuesto vinculados a cuentas contables. El monto anual = mensual x 12.';
COMMENT ON COLUMN public.budget_items.account_id IS 'Cuenta contable asociada (gastos 5xxx). Permite calcular ejecucion presupuestal.';
COMMENT ON COLUMN public.budget_items.category IS 'Categoria del rubro para agrupacion en reportes.';

CREATE INDEX idx_budget_items_budget ON public.budget_items (budget_id);
CREATE INDEX idx_budget_items_tenant ON public.budget_items (tenant_id);
CREATE INDEX idx_budget_items_account ON public.budget_items (account_id) WHERE account_id IS NOT NULL;

-- Auto-update
CREATE TRIGGER trg_budget_items_updated_at
  BEFORE UPDATE ON public.budget_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view budget items in their tenant"
  ON public.budget_items FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert budget items in their tenant"
  ON public.budget_items FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update budget items in their tenant"
  ON public.budget_items FOR UPDATE
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can delete budget items in their tenant"
  ON public.budget_items FOR DELETE
  USING (tenant_id = public.get_current_tenant_id());

-- =============================================
-- FUNCTION: recalculate_budget_total
-- Updates the budget total when items change.
-- =============================================

CREATE OR REPLACE FUNCTION public.recalculate_budget_total()
RETURNS TRIGGER AS $$
DECLARE
  v_budget_id UUID;
  v_total NUMERIC(14,2);
BEGIN
  v_budget_id := COALESCE(NEW.budget_id, OLD.budget_id);

  SELECT COALESCE(SUM(annual_amount), 0)
  INTO v_total
  FROM public.budget_items
  WHERE budget_id = v_budget_id;

  UPDATE public.budgets
  SET total = v_total
  WHERE id = v_budget_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_recalculate_budget_total
  AFTER INSERT OR UPDATE OR DELETE ON public.budget_items
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_budget_total();

COMMENT ON FUNCTION public.recalculate_budget_total IS 'Recalcula el total del presupuesto cuando se modifican rubros.';

-- =============================================
-- FUNCTION: enforce_single_active_budget
-- Ensures only one budget is active per year.
-- =============================================

CREATE OR REPLACE FUNCTION public.enforce_single_active_budget()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' THEN
    -- Deactivate any other active budget for the same year and tenant
    UPDATE public.budgets
    SET status = 'approved'
    WHERE tenant_id = NEW.tenant_id
      AND year = NEW.year
      AND status = 'active'
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_single_active_budget
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION public.enforce_single_active_budget();

COMMENT ON FUNCTION public.enforce_single_active_budget IS 'Garantiza que solo haya un presupuesto activo por ano y tenant.';
