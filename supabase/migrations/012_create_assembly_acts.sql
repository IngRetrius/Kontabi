-- 012_create_assembly_acts.sql
-- Assembly acts (actas de asamblea) for Ley 675 compliance.
-- Required for extraordinary fees and reserve fund withdrawals.

-- =============================================
-- TABLE: assembly_acts
-- =============================================

CREATE TABLE IF NOT EXISTS public.assembly_acts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('ordinary', 'extraordinary')),
  act_number TEXT NOT NULL,
  date DATE NOT NULL,
  quorum NUMERIC(5,2) NOT NULL CHECK (quorum >= 0 AND quorum <= 100),
  description TEXT NOT NULL,
  decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  document_url TEXT,
  attendees_count INTEGER CHECK (attendees_count >= 0),
  total_coefficient NUMERIC(8,6) CHECK (total_coefficient >= 0 AND total_coefficient <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, act_number)
);

COMMENT ON TABLE public.assembly_acts IS 'Actas de asamblea de copropietarios (Ley 675). Soporte legal para decisiones financieras.';
COMMENT ON COLUMN public.assembly_acts.type IS 'ordinary = asamblea ordinaria anual, extraordinary = asamblea extraordinaria.';
COMMENT ON COLUMN public.assembly_acts.quorum IS 'Porcentaje de quorum alcanzado en la asamblea.';
COMMENT ON COLUMN public.assembly_acts.decisions IS 'Array JSON de decisiones tomadas: [{decision, votes_for, votes_against, approved}].';
COMMENT ON COLUMN public.assembly_acts.document_url IS 'URL del documento PDF en Supabase Storage.';
COMMENT ON COLUMN public.assembly_acts.total_coefficient IS 'Coeficiente total representado en la asamblea.';

CREATE INDEX idx_assembly_acts_tenant ON public.assembly_acts (tenant_id);
CREATE INDEX idx_assembly_acts_date ON public.assembly_acts (tenant_id, date DESC);
CREATE INDEX idx_assembly_acts_type ON public.assembly_acts (tenant_id, type);

-- Auto-update
CREATE TRIGGER trg_assembly_acts_updated_at
  BEFORE UPDATE ON public.assembly_acts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.assembly_acts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assembly acts in their tenant"
  ON public.assembly_acts FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert assembly acts in their tenant"
  ON public.assembly_acts FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update assembly acts in their tenant"
  ON public.assembly_acts FOR UPDATE
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can delete assembly acts in their tenant"
  ON public.assembly_acts FOR DELETE
  USING (tenant_id = public.get_current_tenant_id());

-- Audit
CREATE TRIGGER trg_assembly_acts_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.assembly_acts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =============================================
-- Add FK from extraordinary_fees to assembly_acts
-- (deferred because assembly_acts needed to exist first)
-- =============================================

ALTER TABLE public.extraordinary_fees
  ADD CONSTRAINT fk_extraordinary_fees_assembly_act
  FOREIGN KEY (assembly_act_id) REFERENCES public.assembly_acts(id)
  ON DELETE SET NULL;

-- =============================================
-- Add FK from reserve_fund_movements to assembly_acts
-- =============================================

ALTER TABLE public.reserve_fund_movements
  ADD CONSTRAINT fk_reserve_fund_movements_assembly_act
  FOREIGN KEY (assembly_act_id) REFERENCES public.assembly_acts(id)
  ON DELETE SET NULL;
