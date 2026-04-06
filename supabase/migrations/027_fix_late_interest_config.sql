-- 027_fix_late_interest_config.sql
-- Fix calculate_late_interest to read individual key-value settings
-- instead of expecting a JSON blob under key 'late_fees'.
-- The tenant_settings.value column is TEXT, not JSONB.

CREATE OR REPLACE FUNCTION public.calculate_late_interest(
  p_period TEXT DEFAULT NULL
)
RETURNS TABLE (
  invoice_id UUID,
  unit_id UUID,
  period TEXT,
  days_overdue INTEGER,
  outstanding NUMERIC(14,2),
  interest_amount NUMERIC(14,2)
) AS $$
DECLARE
  v_tenant_id UUID;
  v_rate NUMERIC(10,6);
  v_grace_days INTEGER;
  v_compound BOOLEAN;
BEGIN
  v_tenant_id := public.get_current_tenant_id();

  -- Read tenant config from individual key-value settings
  -- (defaults: 1.5% monthly simple, 5 days grace)
  SELECT COALESCE(ts.value::NUMERIC, 0.015)
  INTO v_rate
  FROM public.tenant_settings ts
  WHERE ts.tenant_id = v_tenant_id AND ts.key = 'late_fee_rate';
  IF v_rate IS NULL THEN v_rate := 0.015; END IF;

  -- Note: late_fee_rate is stored as percentage (e.g. "1.5" for 1.5%)
  -- Convert to decimal for calculation
  IF v_rate > 1 THEN v_rate := v_rate / 100; END IF;

  SELECT COALESCE(ts.value::INTEGER, 5)
  INTO v_grace_days
  FROM public.tenant_settings ts
  WHERE ts.tenant_id = v_tenant_id AND ts.key = 'grace_period_days';
  IF v_grace_days IS NULL THEN v_grace_days := 5; END IF;

  SELECT COALESCE(ts.value = 'compound', FALSE)
  INTO v_compound
  FROM public.tenant_settings ts
  WHERE ts.tenant_id = v_tenant_id AND ts.key = 'late_fee_type';
  IF v_compound IS NULL THEN v_compound := FALSE; END IF;

  RETURN QUERY
  SELECT
    i.id AS invoice_id,
    i.unit_id,
    i.period,
    (CURRENT_DATE - i.due_date - v_grace_days)::INTEGER AS days_overdue,
    (i.total - i.paid_amount) AS outstanding,
    CASE
      WHEN (CURRENT_DATE - i.due_date) <= v_grace_days THEN 0::NUMERIC(14,2)
      WHEN v_compound THEN
        ROUND(
          (i.total - i.paid_amount) * (POWER(1 + v_rate, CEIL((CURRENT_DATE - i.due_date - v_grace_days)::NUMERIC / 30)) - 1),
          2
        )::NUMERIC(14,2)
      ELSE
        ROUND(
          (i.total - i.paid_amount) * v_rate * CEIL((CURRENT_DATE - i.due_date - v_grace_days)::NUMERIC / 30),
          2
        )::NUMERIC(14,2)
    END AS interest_amount
  FROM public.invoices i
  WHERE i.tenant_id = v_tenant_id
    AND i.status IN ('overdue', 'partial')
    AND i.due_date < CURRENT_DATE
    AND (i.total - i.paid_amount) > 0
    AND (p_period IS NULL OR i.period = p_period);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.calculate_late_interest IS 'Calcula intereses de mora para cobros vencidos. Lee configuracion de tenant_settings (late_fee_rate, grace_period_days, late_fee_type).';
