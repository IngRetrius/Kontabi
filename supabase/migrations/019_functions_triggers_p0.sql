-- 019_functions_triggers_p0.sql
-- Audit trigger function. Applied to core tables in P0.
-- Additional functions (validate_journal_entry_balance, check_period_lock, etc.)
-- will be added in later products (P2, P4, P5).

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
  v_old_data JSONB;
  v_new_data JSONB;
  v_record_id TEXT;
  v_row JSONB;
BEGIN
  -- Build row as JSONB to safely check for tenant_id column
  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD);
    v_record_id := OLD.id::TEXT;
  ELSE
    v_row := to_jsonb(NEW);
    v_record_id := NEW.id::TEXT;
  END IF;

  -- Determine tenant_id: use tenant_id column if present, otherwise use id (for tenants table)
  IF v_row ? 'tenant_id' THEN
    v_tenant_id := (v_row->>'tenant_id')::UUID;
  ELSE
    v_tenant_id := (v_row->>'id')::UUID;
  END IF;

  -- Get current user (may be null for system operations like triggers)
  BEGIN
    v_user_id := (
      SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid() LIMIT 1
    );
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  -- Build data payloads
  IF TG_OP = 'INSERT' THEN
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  ELSIF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  END IF;

  -- Insert audit record
  INSERT INTO public.audit_log (
    tenant_id, user_id, table_name, record_id, operation, old_data, new_data
  ) VALUES (
    v_tenant_id, v_user_id, TG_TABLE_NAME, v_record_id, TG_OP, v_old_data, v_new_data
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit trigger to core tables
CREATE TRIGGER trg_tenants_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER trg_users_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

COMMENT ON FUNCTION public.audit_trigger IS 'Generic audit trigger. Captures old/new data for any table with tenant_id and id columns.';
