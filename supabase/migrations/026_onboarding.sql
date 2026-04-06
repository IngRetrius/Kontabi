-- 026_onboarding.sql
-- Adds onboarding tracking to tenants and seeds chart of accounts on new tenant creation.

-- 1. Add onboarding_completed_at to tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.tenants.onboarding_completed_at
  IS 'NULL = onboarding pending. Set when the mandatory setup wizard is completed.';

-- 2. Update handle_new_user to also seed chart of accounts for new tenants
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_tenant_name TEXT;
  v_full_name TEXT;
BEGIN
  v_tenant_name := NEW.raw_user_meta_data->>'tenant_name';
  v_full_name := NEW.raw_user_meta_data->>'full_name';

  IF v_tenant_name IS NULL OR v_tenant_name = '' THEN
    v_tenant_name := 'Mi Conjunto';
  END IF;
  IF v_full_name IS NULL OR v_full_name = '' THEN
    v_full_name := COALESCE(NEW.email, 'Usuario');
  END IF;

  -- Create tenant (onboarding_completed_at stays NULL = pending)
  INSERT INTO public.tenants (name, nit, address, stratum)
  VALUES (v_tenant_name, '000000000', 'Por configurar', 3)
  RETURNING id INTO v_tenant_id;

  -- Create user record
  INSERT INTO public.users (auth_id, tenant_id, email, full_name, role)
  VALUES (NEW.id, v_tenant_id, NEW.email, v_full_name, 'admin');

  -- Seed chart of accounts for the new tenant
  PERFORM public.seed_chart_of_accounts(v_tenant_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Mark the pilot tenant as onboarded (it has seed data already)
UPDATE public.tenants
SET onboarding_completed_at = now()
WHERE id = '00000000-0000-0000-0000-000000000001';
