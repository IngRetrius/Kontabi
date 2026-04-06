-- 010_create_reserve_fund.sql
-- Reserve fund management per Art. 35 Ley 675 de 2001.
-- Minimum 1% of annual budget. Withdrawals require assembly act.

-- =============================================
-- TABLE: reserve_fund
-- =============================================

CREATE TABLE IF NOT EXISTS public.reserve_fund (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  current_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  legal_minimum NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (legal_minimum >= 0),
  budget_percentage NUMERIC(5,2) NOT NULL DEFAULT 1.00 CHECK (budget_percentage >= 0 AND budget_percentage <= 100),
  status TEXT NOT NULL DEFAULT 'compliant' CHECK (status IN ('compliant', 'below_minimum', 'critical')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

COMMENT ON TABLE public.reserve_fund IS 'Fondo de reserva (Art. 35 Ley 675). Cada tenant tiene exactamente un registro.';
COMMENT ON COLUMN public.reserve_fund.legal_minimum IS 'Minimo legal = 1% del presupuesto anual vigente.';
COMMENT ON COLUMN public.reserve_fund.status IS 'compliant = saldo >= minimo, below_minimum = saldo < minimo, critical = saldo < 50% del minimo.';

CREATE INDEX idx_reserve_fund_tenant ON public.reserve_fund (tenant_id);

-- Auto-update
CREATE TRIGGER trg_reserve_fund_updated_at
  BEFORE UPDATE ON public.reserve_fund
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.reserve_fund ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reserve fund in their tenant"
  ON public.reserve_fund FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert reserve fund in their tenant"
  ON public.reserve_fund FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update reserve fund in their tenant"
  ON public.reserve_fund FOR UPDATE
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

-- =============================================
-- TABLE: reserve_fund_movements
-- =============================================

CREATE TABLE IF NOT EXISTS public.reserve_fund_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('contribution', 'withdrawal')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  assembly_act_id UUID,
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.reserve_fund_movements IS 'Movimientos del fondo de reserva. Retiros requieren acta de asamblea.';
COMMENT ON COLUMN public.reserve_fund_movements.assembly_act_id IS 'Acta de asamblea que autoriza el retiro. Obligatorio para type=withdrawal.';

CREATE INDEX idx_reserve_fund_movements_tenant ON public.reserve_fund_movements (tenant_id);
CREATE INDEX idx_reserve_fund_movements_date ON public.reserve_fund_movements (tenant_id, date DESC);
CREATE INDEX idx_reserve_fund_movements_type ON public.reserve_fund_movements (tenant_id, type);

-- RLS
ALTER TABLE public.reserve_fund_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reserve fund movements in their tenant"
  ON public.reserve_fund_movements FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert reserve fund movements in their tenant"
  ON public.reserve_fund_movements FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id());

-- Audit
CREATE TRIGGER trg_reserve_fund_movements_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.reserve_fund_movements
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =============================================
-- FUNCTION: update_reserve_fund_balance
-- Updates the fund balance and status after each movement.
-- =============================================

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
    WHEN v_new_balance >= v_minimum THEN 'compliant'
    WHEN v_new_balance >= (v_minimum * 0.5) THEN 'below_minimum'
    ELSE 'critical'
  END
  WHERE tenant_id = NEW.tenant_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_reserve_fund_balance
  AFTER INSERT ON public.reserve_fund_movements
  FOR EACH ROW EXECUTE FUNCTION public.update_reserve_fund_balance();

COMMENT ON FUNCTION public.update_reserve_fund_balance IS 'Actualiza saldo y estado del fondo de reserva al insertar movimiento.';
