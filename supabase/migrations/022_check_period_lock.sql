-- 022_check_period_lock.sql
-- Prevents modifications to transactions and journal entries in closed periods.
-- Requires a tenant_settings entry with key = 'period_lock_date' and value = 'YYYY-MM-DD'.
-- Any transaction/journal entry with date <= period_lock_date is immutable.

-- =============================================
-- FUNCTION: check_period_lock
-- =============================================

CREATE OR REPLACE FUNCTION public.check_period_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_lock_date DATE;
  v_check_date DATE;
BEGIN
  -- Determine tenant_id from the row
  v_tenant_id := COALESCE(NEW.tenant_id, OLD.tenant_id);

  -- Get the period lock date for this tenant
  SELECT value::DATE INTO v_lock_date
  FROM public.tenant_settings
  WHERE tenant_id = v_tenant_id
    AND key = 'period_lock_date';

  -- If no lock date is configured, allow the operation
  IF v_lock_date IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  -- Determine the date to check
  IF TG_OP = 'DELETE' THEN
    v_check_date := OLD.date;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Check both old and new dates (prevent moving in or out of locked period)
    IF OLD.date <= v_lock_date THEN
      RAISE EXCEPTION 'No se puede modificar un registro en un periodo cerrado (fecha: %, cierre: %)',
        OLD.date, v_lock_date;
    END IF;
    v_check_date := NEW.date;
  ELSE
    v_check_date := NEW.date;
  END IF;

  -- Reject if the date falls within the locked period
  IF v_check_date <= v_lock_date THEN
    RAISE EXCEPTION 'No se puede crear o mover un registro a un periodo cerrado (fecha: %, cierre: %)',
      v_check_date, v_lock_date;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.check_period_lock IS 'Prevents INSERT/UPDATE/DELETE on records with date <= tenant period_lock_date setting.';

-- Apply to transactions
CREATE TRIGGER trg_transactions_period_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.check_period_lock();

-- Apply to journal_entries
CREATE TRIGGER trg_journal_entries_period_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.check_period_lock();
