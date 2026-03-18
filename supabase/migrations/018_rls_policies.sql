-- 018_rls_policies.sql
-- Row Level Security policies for multi-tenant isolation.
-- Every table uses tenant_id from the user's JWT to filter rows.

-- Helper: extract tenant_id from the authenticated user's JWT
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS UUID AS $$
  SELECT (
    SELECT u.tenant_id
    FROM public.users u
    WHERE u.auth_id = auth.uid()
    LIMIT 1
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- =============================================
-- TENANTS: users can only see their own tenant
-- =============================================
CREATE POLICY "Users can view their own tenant"
  ON public.tenants FOR SELECT
  USING (id = public.get_current_tenant_id());

CREATE POLICY "Users can update their own tenant"
  ON public.tenants FOR UPDATE
  USING (id = public.get_current_tenant_id())
  WITH CHECK (id = public.get_current_tenant_id());

-- =============================================
-- USERS: scoped to tenant
-- =============================================
CREATE POLICY "Users can view users in their tenant"
  ON public.users FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert into their tenant"
  ON public.users FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update users in their tenant"
  ON public.users FOR UPDATE
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

-- =============================================
-- AUDIT LOG: scoped to tenant (read only)
-- =============================================
CREATE POLICY "Users can view audit logs for their tenant"
  ON public.audit_log FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

-- Audit log inserts are done by triggers (SECURITY DEFINER), not by users directly.
-- No INSERT/UPDATE/DELETE policies for audit_log.
