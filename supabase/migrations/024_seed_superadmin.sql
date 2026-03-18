-- 024_seed_superadmin.sql
-- Replaces handle_new_user to support a dev super_admin account.
-- When registering with 'admin@kontabi.dev', the user is linked
-- to the pilot tenant as super_admin instead of creating a new tenant.
-- All other registrations work as before.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_tenant_name TEXT;
  v_full_name TEXT;
  v_role TEXT;
  v_pilot_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  v_full_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email, 'Usuario');

  -- Dev super_admin: link to pilot tenant
  IF NEW.email = 'admin@kontabi.dev' THEN
    -- Check pilot tenant exists
    IF EXISTS (SELECT 1 FROM public.tenants WHERE id = v_pilot_tenant_id) THEN
      v_tenant_id := v_pilot_tenant_id;
      v_role := 'super_admin';
      v_full_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), 'Administrador Kontabi');
    ELSE
      -- Pilot tenant missing, fall through to normal flow
      v_tenant_id := NULL;
    END IF;
  END IF;

  -- Normal flow: create a new tenant
  IF v_tenant_id IS NULL THEN
    v_tenant_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'tenant_name', ''), 'Mi Conjunto');
    v_role := 'admin';

    INSERT INTO public.tenants (name, nit, address, stratum)
    VALUES (v_tenant_name, '000000000', 'Por configurar', 3)
    RETURNING id INTO v_tenant_id;
  END IF;

  -- Create public.users record
  INSERT INTO public.users (auth_id, tenant_id, email, full_name, role)
  VALUES (NEW.id, v_tenant_id, NEW.email, v_full_name, v_role);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user IS 'Auto-creates tenant and user on signup. Dev account admin@kontabi.dev links to pilot tenant as super_admin.';
