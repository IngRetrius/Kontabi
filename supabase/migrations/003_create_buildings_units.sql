-- 003_create_buildings_units.sql
-- Physical structure of the condominium: towers/buildings and individual units.

-- Buildings (torres/bloques)
CREATE TABLE IF NOT EXISTS public.buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  floors INTEGER NOT NULL CHECK (floors > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_buildings_tenant_id ON public.buildings (tenant_id);

CREATE TRIGGER trg_buildings_updated_at
  BEFORE UPDATE ON public.buildings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.buildings IS 'Torres o bloques del conjunto residencial.';

-- Units (unidades: apartamentos, locales, parqueaderos, depositos)
CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  building_id UUID NOT NULL REFERENCES public.buildings(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  floor INTEGER NOT NULL CHECK (floor >= 0),
  unit_type TEXT NOT NULL DEFAULT 'apartment' CHECK (unit_type IN ('apartment', 'commercial', 'parking', 'storage')),
  area_m2 NUMERIC(10,2) NOT NULL CHECK (area_m2 > 0),
  coefficient NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (coefficient >= 0 AND coefficient <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_units_tenant_id ON public.units (tenant_id);
CREATE INDEX idx_units_building_id ON public.units (building_id);
CREATE INDEX idx_units_unit_type ON public.units (unit_type);
CREATE UNIQUE INDEX idx_units_number_building ON public.units (tenant_id, building_id, number);

CREATE TRIGGER trg_units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.units IS 'Unidades inmobiliarias: apartamentos, locales, parqueaderos, depositos.';

-- RLS Policies for buildings
CREATE POLICY "Users can view buildings in their tenant"
  ON public.buildings FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert buildings in their tenant"
  ON public.buildings FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update buildings in their tenant"
  ON public.buildings FOR UPDATE
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can delete buildings in their tenant"
  ON public.buildings FOR DELETE
  USING (tenant_id = public.get_current_tenant_id());

-- RLS Policies for units
CREATE POLICY "Users can view units in their tenant"
  ON public.units FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert units in their tenant"
  ON public.units FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update units in their tenant"
  ON public.units FOR UPDATE
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can delete units in their tenant"
  ON public.units FOR DELETE
  USING (tenant_id = public.get_current_tenant_id());

-- Audit triggers
CREATE TRIGGER trg_buildings_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.buildings
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER trg_units_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.units
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();
