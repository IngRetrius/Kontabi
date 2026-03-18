-- 016_create_settings_config.sql
-- Tenant settings (key-value) for configurable business rules.
-- Uses tenants.config JSONB (already exists) for structured configuration.
-- Also creates common_areas table for Fase 1.3.

-- =============================================
-- TENANT SETTINGS: key-value per tenant
-- =============================================

CREATE TABLE IF NOT EXISTS public.tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);

CREATE INDEX idx_tenant_settings_tenant_id ON public.tenant_settings (tenant_id);

CREATE TRIGGER trg_tenant_settings_updated_at
  BEFORE UPDATE ON public.tenant_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tenant_settings ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.tenant_settings IS E'Key-value settings per tenant. Known keys:\n- billing_cutoff_day (1-28, default 1)\n- payment_due_day (1-28, default 15)\n- late_fee_rate (percentage, default 1.5)\n- grace_period_days (integer, default 5)\n- late_fee_type (simple|compound, default simple)\n- invoice_advance_days (integer, default 5)\n- overdue_reminder_days (integer, default 3)\n- report_header_text (string)\n- primary_color (hex, default #1a1a1a)\n- logo_pdf_url (string)';

-- RLS Policies
CREATE POLICY "Users can view settings in their tenant"
  ON public.tenant_settings FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert settings in their tenant"
  ON public.tenant_settings FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update settings in their tenant"
  ON public.tenant_settings FOR UPDATE
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can delete settings in their tenant"
  ON public.tenant_settings FOR DELETE
  USING (tenant_id = public.get_current_tenant_id());

-- Audit trigger
CREATE TRIGGER trg_tenant_settings_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.tenant_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =============================================
-- COMMON AREAS: shared spaces in the condominium
-- =============================================

CREATE TABLE IF NOT EXISTS public.common_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  capacity INTEGER CHECK (capacity > 0),
  schedule TEXT,
  booking_cost NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (booking_cost >= 0),
  deposit NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (deposit >= 0),
  is_bookable BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_common_areas_tenant_id ON public.common_areas (tenant_id);

CREATE TRIGGER trg_common_areas_updated_at
  BEFORE UPDATE ON public.common_areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.common_areas ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.common_areas IS 'Zonas comunes del conjunto: salon social, piscina, gimnasio, etc.';

-- RLS Policies
CREATE POLICY "Users can view common areas in their tenant"
  ON public.common_areas FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert common areas in their tenant"
  ON public.common_areas FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update common areas in their tenant"
  ON public.common_areas FOR UPDATE
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can delete common areas in their tenant"
  ON public.common_areas FOR DELETE
  USING (tenant_id = public.get_current_tenant_id());

-- Audit trigger
CREATE TRIGGER trg_common_areas_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.common_areas
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =============================================
-- HELPER: upsert setting (insert or update)
-- =============================================

CREATE OR REPLACE FUNCTION public.upsert_tenant_setting(
  p_tenant_id UUID,
  p_key TEXT,
  p_value TEXT
) RETURNS VOID AS $$
BEGIN
  INSERT INTO public.tenant_settings (tenant_id, key, value)
  VALUES (p_tenant_id, p_key, p_value)
  ON CONFLICT (tenant_id, key)
  DO UPDATE SET value = EXCLUDED.value, updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.upsert_tenant_setting IS 'Insert or update a single tenant setting.';
