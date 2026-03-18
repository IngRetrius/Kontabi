-- 020_on_auth_user_created.sql
-- Trigger that fires when a new user registers via Supabase Auth.
-- Creates a tenant record and a public.users record automatically.
-- Uses SECURITY DEFINER to bypass RLS (no user context exists yet at signup time).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_tenant_name TEXT;
  v_full_name TEXT;
BEGIN
  -- Extract metadata passed from signUp options.data
  v_tenant_name := NEW.raw_user_meta_data->>'tenant_name';
  v_full_name := NEW.raw_user_meta_data->>'full_name';

  -- Fallback defaults if metadata is missing
  IF v_tenant_name IS NULL OR v_tenant_name = '' THEN
    v_tenant_name := 'Mi Conjunto';
  END IF;
  IF v_full_name IS NULL OR v_full_name = '' THEN
    v_full_name := COALESCE(NEW.email, 'Usuario');
  END IF;

  -- Create the tenant with placeholder values for fields configured later in settings
  INSERT INTO public.tenants (name, nit, address, stratum)
  VALUES (v_tenant_name, '000000000', 'Por configurar', 3)
  RETURNING id INTO v_tenant_id;

  -- Create public.users record linked to auth.users and the new tenant
  INSERT INTO public.users (auth_id, tenant_id, email, full_name, role)
  VALUES (NEW.id, v_tenant_id, NEW.email, v_full_name, 'admin');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire after every new auth signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user IS 'Auto-creates tenant and public.users record when a user signs up via Supabase Auth.';
