-- 028_fix_reserve_fund_trigger.sql
-- Fix: make update_reserve_fund_balance SECURITY DEFINER so it can
-- upsert into reserve_fund even when RLS is enabled and no prior
-- record exists for the tenant.

CREATE OR REPLACE FUNCTION public.update_reserve_fund_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_delta NUMERIC(14,2);
  v_new_balance NUMERIC(14,2);
  v_minimum NUMERIC(14,2);
BEGIN
  -- Calculate delta
  IF NEW.type = 'contribution' THEN
    v_delta := NEW.amount;
  ELSE
    v_delta := -NEW.amount;
  END IF;

  -- Upsert reserve fund record
  INSERT INTO public.reserve_fund (tenant_id, current_balance)
  VALUES (NEW.tenant_id, v_delta)
  ON CONFLICT (tenant_id)
  DO UPDATE SET current_balance = public.reserve_fund.current_balance + v_delta;

  -- Get updated values
  SELECT current_balance, legal_minimum
  INTO v_new_balance, v_minimum
  FROM public.reserve_fund
  WHERE tenant_id = NEW.tenant_id;

  -- Update status
  UPDATE public.reserve_fund
  SET status = CASE
    WHEN v_minimum <= 0 THEN 'compliant'
    WHEN v_new_balance >= v_minimum THEN 'compliant'
    WHEN v_new_balance >= (v_minimum * 0.5) THEN 'below_minimum'
    ELSE 'critical'
  END
  WHERE tenant_id = NEW.tenant_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_reserve_fund_balance IS 'Actualiza saldo y estado del fondo de reserva al insertar movimiento. SECURITY DEFINER para bypass RLS en upsert.';
