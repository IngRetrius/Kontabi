-- 029_sync_reserve_fund_from_budget.sql
-- Automatically update reserve_fund.legal_minimum when a budget becomes active.
-- Art. 35 Ley 675: fondo de reserva minimo = presupuesto anual * reserve_fund_pct.
--
-- Fires on:
--   1. Budget status changes to 'active'
--   2. Budget total or reserve_fund_pct changes while status = 'active'
--
-- Also upserts the reserve_fund record if it doesn't exist yet (first budget activation).

CREATE OR REPLACE FUNCTION public.sync_reserve_fund_from_budget()
RETURNS TRIGGER AS $$
DECLARE
  v_minimum NUMERIC(14,2);
  v_current NUMERIC(14,2);
BEGIN
  -- Only act when status is 'active'
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  v_minimum := ROUND(NEW.total * NEW.reserve_fund_pct / 100, 2);

  -- Upsert reserve fund record
  INSERT INTO public.reserve_fund (tenant_id, legal_minimum, budget_percentage, current_balance)
  VALUES (NEW.tenant_id, v_minimum, NEW.reserve_fund_pct, 0)
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    legal_minimum = v_minimum,
    budget_percentage = NEW.reserve_fund_pct;

  -- Recalculate status based on new minimum
  SELECT current_balance INTO v_current
  FROM public.reserve_fund
  WHERE tenant_id = NEW.tenant_id;

  UPDATE public.reserve_fund
  SET status = CASE
    WHEN v_minimum <= 0 THEN 'compliant'
    WHEN v_current >= v_minimum THEN 'compliant'
    WHEN v_current >= (v_minimum * 0.5) THEN 'below_minimum'
    ELSE 'critical'
  END
  WHERE tenant_id = NEW.tenant_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire when budget becomes active or when active budget totals change
CREATE TRIGGER trg_sync_reserve_fund_from_budget
  AFTER INSERT OR UPDATE OF status, total, reserve_fund_pct ON public.budgets
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION public.sync_reserve_fund_from_budget();

COMMENT ON FUNCTION public.sync_reserve_fund_from_budget IS
  'Sincroniza reserve_fund.legal_minimum desde el presupuesto activo (Art. 35 Ley 675). Se ejecuta al activar un presupuesto o al cambiar su total/porcentaje.';

-- Backfill: if there is already an active budget, sync now
DO $$
DECLARE
  r RECORD;
  v_minimum NUMERIC(14,2);
  v_current NUMERIC(14,2);
BEGIN
  FOR r IN
    SELECT id, tenant_id, total, reserve_fund_pct
    FROM public.budgets
    WHERE status = 'active'
  LOOP
    v_minimum := ROUND(r.total * r.reserve_fund_pct / 100, 2);

    INSERT INTO public.reserve_fund (tenant_id, legal_minimum, budget_percentage, current_balance)
    VALUES (r.tenant_id, v_minimum, r.reserve_fund_pct, 0)
    ON CONFLICT (tenant_id)
    DO UPDATE SET
      legal_minimum = v_minimum,
      budget_percentage = r.reserve_fund_pct;

    SELECT current_balance INTO v_current
    FROM public.reserve_fund
    WHERE tenant_id = r.tenant_id;

    UPDATE public.reserve_fund
    SET status = CASE
      WHEN v_minimum <= 0 THEN 'compliant'
      WHEN v_current >= v_minimum THEN 'compliant'
      WHEN v_current >= (v_minimum * 0.5) THEN 'below_minimum'
      ELSE 'critical'
    END
    WHERE tenant_id = r.tenant_id;
  END LOOP;
END $$;
