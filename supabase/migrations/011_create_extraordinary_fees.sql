-- 011_create_extraordinary_fees.sql
-- Extraordinary fees per Art. 29 Ley 675 de 2001.
-- Must be linked to an assembly act. Can be split into installments.

-- =============================================
-- TABLE: extraordinary_fees
-- =============================================

CREATE TABLE IF NOT EXISTS public.extraordinary_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  concept TEXT NOT NULL,
  total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount > 0),
  distribution TEXT NOT NULL DEFAULT 'coefficient' CHECK (distribution IN ('coefficient', 'equal')),
  start_date DATE NOT NULL,
  installments INTEGER NOT NULL DEFAULT 1 CHECK (installments >= 1 AND installments <= 60),
  assembly_act_id UUID,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.extraordinary_fees IS 'Cuotas extraordinarias (Art. 29 Ley 675). Requieren acta de asamblea.';
COMMENT ON COLUMN public.extraordinary_fees.distribution IS 'coefficient = por coeficiente de copropiedad, equal = partes iguales.';
COMMENT ON COLUMN public.extraordinary_fees.installments IS 'Numero de cuotas mensuales para fraccionar el pago.';

CREATE INDEX idx_extraordinary_fees_tenant ON public.extraordinary_fees (tenant_id);
CREATE INDEX idx_extraordinary_fees_status ON public.extraordinary_fees (tenant_id, status);
CREATE INDEX idx_extraordinary_fees_act ON public.extraordinary_fees (assembly_act_id) WHERE assembly_act_id IS NOT NULL;

-- Auto-update
CREATE TRIGGER trg_extraordinary_fees_updated_at
  BEFORE UPDATE ON public.extraordinary_fees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.extraordinary_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view extraordinary fees in their tenant"
  ON public.extraordinary_fees FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert extraordinary fees in their tenant"
  ON public.extraordinary_fees FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update extraordinary fees in their tenant"
  ON public.extraordinary_fees FOR UPDATE
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can delete active extraordinary fees in their tenant"
  ON public.extraordinary_fees FOR DELETE
  USING (tenant_id = public.get_current_tenant_id() AND status = 'active');

-- Audit
CREATE TRIGGER trg_extraordinary_fees_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.extraordinary_fees
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =============================================
-- TABLE: extraordinary_fee_units
-- =============================================

CREATE TABLE IF NOT EXISTS public.extraordinary_fee_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  fee_id UUID NOT NULL REFERENCES public.extraordinary_fees(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount >= 0),
  installment_amount NUMERIC(14,2) NOT NULL CHECK (installment_amount >= 0),
  paid_installments INTEGER NOT NULL DEFAULT 0 CHECK (paid_installments >= 0),
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  balance NUMERIC(14,2) NOT NULL CHECK (balance >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (fee_id, unit_id)
);

COMMENT ON TABLE public.extraordinary_fee_units IS 'Distribucion de cuota extraordinaria por unidad.';
COMMENT ON COLUMN public.extraordinary_fee_units.installment_amount IS 'Monto de cada cuota mensual = total_amount / installments.';
COMMENT ON COLUMN public.extraordinary_fee_units.balance IS 'Saldo pendiente = total_amount - paid_amount.';

CREATE INDEX idx_extraordinary_fee_units_fee ON public.extraordinary_fee_units (fee_id);
CREATE INDEX idx_extraordinary_fee_units_unit ON public.extraordinary_fee_units (unit_id);
CREATE INDEX idx_extraordinary_fee_units_tenant ON public.extraordinary_fee_units (tenant_id);
CREATE INDEX idx_extraordinary_fee_units_status ON public.extraordinary_fee_units (tenant_id, status);

-- Auto-update
CREATE TRIGGER trg_extraordinary_fee_units_updated_at
  BEFORE UPDATE ON public.extraordinary_fee_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.extraordinary_fee_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view extraordinary fee units in their tenant"
  ON public.extraordinary_fee_units FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert extraordinary fee units in their tenant"
  ON public.extraordinary_fee_units FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update extraordinary fee units in their tenant"
  ON public.extraordinary_fee_units FOR UPDATE
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

-- =============================================
-- FUNCTION: update_extraordinary_fee_status
-- Marks fee as completed when all units are paid.
-- =============================================

CREATE OR REPLACE FUNCTION public.update_extraordinary_fee_status()
RETURNS TRIGGER AS $$
DECLARE
  v_total_units INTEGER;
  v_paid_units INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'paid')
  INTO v_total_units, v_paid_units
  FROM public.extraordinary_fee_units
  WHERE fee_id = NEW.fee_id;

  IF v_total_units > 0 AND v_total_units = v_paid_units THEN
    UPDATE public.extraordinary_fees
    SET status = 'completed'
    WHERE id = NEW.fee_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_extraordinary_fee_status
  AFTER UPDATE OF status ON public.extraordinary_fee_units
  FOR EACH ROW
  WHEN (NEW.status = 'paid')
  EXECUTE FUNCTION public.update_extraordinary_fee_status();

COMMENT ON FUNCTION public.update_extraordinary_fee_status IS 'Marca cuota extraordinaria como completada cuando todas las unidades han pagado.';
