-- 004_create_owners.sql
-- Property owners linked to units. Supports ownership history (one active per unit).

CREATE TABLE IF NOT EXISTS public.owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'cc' CHECK (document_type IN ('cc', 'ce', 'nit', 'passport')),
  document_number TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  is_current BOOLEAN NOT NULL DEFAULT true,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_owners_tenant_id ON public.owners (tenant_id);
CREATE INDEX idx_owners_unit_id ON public.owners (unit_id);
CREATE INDEX idx_owners_document ON public.owners (document_type, document_number);
CREATE INDEX idx_owners_is_current ON public.owners (unit_id, is_current) WHERE is_current = true;

CREATE TRIGGER trg_owners_updated_at
  BEFORE UPDATE ON public.owners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.owners IS 'Propietarios de unidades. is_current=true indica propietario vigente.';

-- RLS Policies
CREATE POLICY "Users can view owners in their tenant"
  ON public.owners FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert owners in their tenant"
  ON public.owners FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update owners in their tenant"
  ON public.owners FOR UPDATE
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can delete owners in their tenant"
  ON public.owners FOR DELETE
  USING (tenant_id = public.get_current_tenant_id());

-- Audit trigger
CREATE TRIGGER trg_owners_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.owners
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
