-- 013_create_bank_reconciliation.sql
-- Bank reconciliation tables: statements, statement lines, matches, and period locks.

-- =============================================
-- TABLE: bank_accounts
-- =============================================

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'corriente' CHECK (account_type IN ('corriente', 'ahorros')),
  account_id UUID REFERENCES public.accounts(id),
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, bank_name, account_number)
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_accounts_tenant_isolation" ON public.bank_accounts
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "bank_accounts_tenant_insert" ON public.bank_accounts
  FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "bank_accounts_tenant_update" ON public.bank_accounts
  FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "bank_accounts_tenant_delete" ON public.bank_accounts
  FOR DELETE USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

COMMENT ON TABLE public.bank_accounts IS 'Bank accounts configured per tenant for reconciliation.';

-- =============================================
-- TABLE: bank_statements
-- =============================================

CREATE TABLE IF NOT EXISTS public.bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  bank_name TEXT NOT NULL,
  period TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  total_lines INTEGER NOT NULL DEFAULT 0,
  total_debits NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_credits NUMERIC(18,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'reconciled')),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_statements_tenant_isolation" ON public.bank_statements
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "bank_statements_tenant_insert" ON public.bank_statements
  FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "bank_statements_tenant_update" ON public.bank_statements
  FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "bank_statements_tenant_delete" ON public.bank_statements
  FOR DELETE USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

CREATE INDEX idx_bank_statements_tenant_period ON public.bank_statements (tenant_id, period);

COMMENT ON TABLE public.bank_statements IS 'Imported bank statement files for reconciliation.';

-- =============================================
-- TABLE: bank_statement_lines
-- =============================================

CREATE TABLE IF NOT EXISTS public.bank_statement_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id UUID NOT NULL REFERENCES public.bank_statements(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  line_date DATE NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,
  amount NUMERIC(18,2) NOT NULL,
  line_type TEXT NOT NULL CHECK (line_type IN ('debit', 'credit')),
  balance NUMERIC(18,2),
  match_status TEXT NOT NULL DEFAULT 'pending' CHECK (match_status IN ('pending', 'matched', 'manual', 'excluded')),
  matched_transaction_id UUID REFERENCES public.transactions(id),
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_statement_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_statement_lines_tenant_isolation" ON public.bank_statement_lines
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "bank_statement_lines_tenant_insert" ON public.bank_statement_lines
  FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "bank_statement_lines_tenant_update" ON public.bank_statement_lines
  FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

CREATE INDEX idx_statement_lines_statement ON public.bank_statement_lines (statement_id);
CREATE INDEX idx_statement_lines_amount ON public.bank_statement_lines (tenant_id, amount);
CREATE INDEX idx_statement_lines_date ON public.bank_statement_lines (tenant_id, line_date);
CREATE INDEX idx_statement_lines_match ON public.bank_statement_lines (match_status);

COMMENT ON TABLE public.bank_statement_lines IS 'Individual lines parsed from a bank statement CSV.';

-- =============================================
-- TABLE: reconciliation_matches
-- =============================================

CREATE TABLE IF NOT EXISTS public.reconciliation_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  statement_line_id UUID NOT NULL REFERENCES public.bank_statement_lines(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id),
  score NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  match_type TEXT NOT NULL DEFAULT 'auto' CHECK (match_type IN ('auto', 'manual')),
  confirmed BOOLEAN NOT NULL DEFAULT false,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reconciliation_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reconciliation_matches_tenant_isolation" ON public.reconciliation_matches
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "reconciliation_matches_tenant_insert" ON public.reconciliation_matches
  FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "reconciliation_matches_tenant_update" ON public.reconciliation_matches
  FOR UPDATE USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

CREATE INDEX idx_reconciliation_matches_line ON public.reconciliation_matches (statement_line_id);
CREATE INDEX idx_reconciliation_matches_tx ON public.reconciliation_matches (transaction_id);

-- Prevent duplicate matches: one statement line -> one confirmed match
CREATE UNIQUE INDEX idx_reconciliation_matches_unique_confirmed
  ON public.reconciliation_matches (statement_line_id)
  WHERE confirmed = true;

COMMENT ON TABLE public.reconciliation_matches IS 'Links between bank statement lines and Kontabi transactions.';

-- =============================================
-- TABLE: period_locks
-- =============================================

CREATE TABLE IF NOT EXISTS public.period_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by UUID NOT NULL REFERENCES public.users(id),
  reason TEXT,
  reconciliation_done BOOLEAN NOT NULL DEFAULT false,
  balances_verified BOOLEAN NOT NULL DEFAULT false,
  provision_calculated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period)
);

ALTER TABLE public.period_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "period_locks_tenant_isolation" ON public.period_locks
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "period_locks_tenant_insert" ON public.period_locks
  FOR INSERT WITH CHECK (tenant_id = (SELECT tenant_id FROM public.users WHERE auth_id = auth.uid()));

CREATE INDEX idx_period_locks_tenant ON public.period_locks (tenant_id, period);

COMMENT ON TABLE public.period_locks IS 'Tracks locked accounting periods. Closing a period prevents modifications via check_period_lock trigger.';

-- =============================================
-- Audit triggers (reuse existing audit_trigger function)
-- =============================================

CREATE TRIGGER trg_bank_accounts_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER trg_bank_statements_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.bank_statements
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER trg_reconciliation_matches_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.reconciliation_matches
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER trg_period_locks_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.period_locks
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =============================================
-- updated_at triggers
-- =============================================

CREATE TRIGGER trg_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_bank_statements_updated_at
  BEFORE UPDATE ON public.bank_statements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
