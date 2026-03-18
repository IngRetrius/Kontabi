-- 023_account_balances_view.sql
-- Materialized view for pre-computed account balances per period.
-- Refreshed after confirming journal entries for fast dashboard/report queries.

-- =============================================
-- MATERIALIZED VIEW: account_balances
-- =============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS public.account_balances AS
SELECT
  a.id AS account_id,
  a.code AS account_code,
  a.name AS account_name,
  a.account_type,
  a.nature,
  je.tenant_id,
  TO_CHAR(je.date, 'YYYY-MM') AS period,
  COALESCE(SUM(jel.debit), 0) AS debit_total,
  COALESCE(SUM(jel.credit), 0) AS credit_total,
  CASE
    WHEN a.nature = 'debito' THEN COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0)
    ELSE COALESCE(SUM(jel.credit), 0) - COALESCE(SUM(jel.debit), 0)
  END AS balance
FROM public.journal_entry_lines jel
JOIN public.journal_entries je ON je.id = jel.journal_entry_id
JOIN public.accounts a ON a.id = jel.account_id
WHERE je.status = 'confirmed'
GROUP BY a.id, a.code, a.name, a.account_type, a.nature, je.tenant_id, TO_CHAR(je.date, 'YYYY-MM')
WITH NO DATA;

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX idx_account_balances_unique
  ON public.account_balances (tenant_id, account_id, period);

CREATE INDEX idx_account_balances_tenant_period
  ON public.account_balances (tenant_id, period);

CREATE INDEX idx_account_balances_account
  ON public.account_balances (account_id);

COMMENT ON MATERIALIZED VIEW public.account_balances IS 'Pre-computed account balances per period. Refresh after confirming journal entries.';

-- =============================================
-- FUNCTION: refresh_account_balances
-- Uses CONCURRENTLY to avoid blocking reads.
-- =============================================

CREATE OR REPLACE FUNCTION public.refresh_account_balances()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.account_balances;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.refresh_account_balances IS 'Refreshes account_balances materialized view concurrently. Call after confirming journal entries.';

-- Initial refresh to populate with existing data
REFRESH MATERIALIZED VIEW public.account_balances;
