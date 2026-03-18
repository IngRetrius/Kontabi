-- 005_create_accounts.sql
-- Chart of accounts for NIIF Grupo 3 (Colombian simplified accounting).
-- Hierarchical structure: class > group > account (levels 1-3).
-- Tenants can add sub-accounts at level 4 (detail) but cannot modify the base structure.

-- =============================================
-- TABLE: accounts
-- =============================================

CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('activo', 'pasivo', 'patrimonio', 'ingreso', 'gasto')),
  nature TEXT NOT NULL CHECK (nature IN ('debito', 'credito')),
  parent_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 4),
  is_detail BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

COMMENT ON TABLE public.accounts IS 'Plan de cuentas NIIF Grupo 3 para propiedad horizontal. Decreto 2420 de 2015.';
COMMENT ON COLUMN public.accounts.code IS 'Codigo numerico jerarquico: 1000 (clase), 1100 (grupo), 1110 (cuenta), 111001 (subcuenta).';
COMMENT ON COLUMN public.accounts.account_type IS 'Clasificacion contable: activo, pasivo, patrimonio, ingreso, gasto.';
COMMENT ON COLUMN public.accounts.nature IS 'Naturaleza de la cuenta: debito (activos/gastos aumentan al debitar) o credito (pasivos/patrimonio/ingresos aumentan al acreditar).';
COMMENT ON COLUMN public.accounts.level IS 'Nivel jerarquico: 1=clase, 2=grupo, 3=cuenta, 4=subcuenta de detalle.';
COMMENT ON COLUMN public.accounts.is_detail IS 'true = cuenta de detalle donde se registran movimientos. false = cuenta sumaria (solo agrupa).';
COMMENT ON COLUMN public.accounts.is_system IS 'true = cuenta base del plan NIIF, no se puede eliminar ni modificar su codigo/tipo/naturaleza.';

-- Indexes
CREATE INDEX idx_accounts_tenant_id ON public.accounts (tenant_id);
CREATE INDEX idx_accounts_parent_id ON public.accounts (parent_id);
CREATE INDEX idx_accounts_code ON public.accounts (tenant_id, code);
CREATE INDEX idx_accounts_type ON public.accounts (tenant_id, account_type);
CREATE INDEX idx_accounts_detail ON public.accounts (tenant_id, is_detail) WHERE is_detail = true;

-- Auto-update
CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accounts in their tenant"
  ON public.accounts FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert accounts in their tenant"
  ON public.accounts FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update accounts in their tenant"
  ON public.accounts FOR UPDATE
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can delete non-system accounts in their tenant"
  ON public.accounts FOR DELETE
  USING (tenant_id = public.get_current_tenant_id() AND is_system = false);

-- Audit
CREATE TRIGGER trg_accounts_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =============================================
-- FUNCTION: seed_chart_of_accounts
-- Seeds the base NIIF Grupo 3 chart for a given tenant.
-- Called during tenant onboarding or manually.
-- Idempotent: skips existing accounts via ON CONFLICT.
-- =============================================

CREATE OR REPLACE FUNCTION public.seed_chart_of_accounts(p_tenant_id UUID)
RETURNS VOID AS $$
DECLARE
  -- Level 1 IDs (classes)
  v_1000 UUID; v_2000 UUID; v_3000 UUID; v_4000 UUID; v_5000 UUID;
  -- Level 2 IDs (groups)
  v_1100 UUID; v_1200 UUID; v_1300 UUID;
  v_2100 UUID; v_2200 UUID;
  v_3000g UUID;
  v_4100 UUID; v_4200 UUID;
  v_5100 UUID; v_5200 UUID;
BEGIN
  -- =============================================
  -- CLASE 1: ACTIVOS (naturaleza debito)
  -- =============================================
  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system)
  VALUES (p_tenant_id, '1000', 'ACTIVOS', 'activo', 'debito', NULL, 1, false, true)
  ON CONFLICT (tenant_id, code) DO NOTHING
  RETURNING id INTO v_1000;
  IF v_1000 IS NULL THEN SELECT id INTO v_1000 FROM public.accounts WHERE tenant_id = p_tenant_id AND code = '1000'; END IF;

  -- Grupo 1100: Activos corrientes
  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system)
  VALUES (p_tenant_id, '1100', 'Activos corrientes', 'activo', 'debito', v_1000, 2, false, true)
  ON CONFLICT (tenant_id, code) DO NOTHING
  RETURNING id INTO v_1100;
  IF v_1100 IS NULL THEN SELECT id INTO v_1100 FROM public.accounts WHERE tenant_id = p_tenant_id AND code = '1100'; END IF;

  -- Cuentas de detalle: 1100
  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system, description) VALUES
    (p_tenant_id, '1110', 'Bancos', 'activo', 'debito', v_1100, 3, true, true, 'Cuentas bancarias del conjunto. Saldo refleja disponible en banco.'),
    (p_tenant_id, '1120', 'Caja menor', 'activo', 'debito', v_1100, 3, true, true, 'Fondo de caja menor para gastos menores del dia a dia.'),
    (p_tenant_id, '1130', 'CxC cuotas de administracion', 'activo', 'debito', v_1100, 3, true, true, 'Cuotas ordinarias de administracion pendientes de cobro por unidad.'),
    (p_tenant_id, '1140', 'CxC cuotas extraordinarias', 'activo', 'debito', v_1100, 3, true, true, 'Cuotas extraordinarias (aprobadas por asamblea) pendientes de cobro.'),
    (p_tenant_id, '1150', 'CxC intereses de mora', 'activo', 'debito', v_1100, 3, true, true, 'Intereses generados por mora en pago de cuotas.'),
    (p_tenant_id, '1160', 'CxC otros conceptos', 'activo', 'debito', v_1100, 3, true, true, 'Otras cuentas por cobrar: multas, danos, alquiler zonas comunes.')
  ON CONFLICT (tenant_id, code) DO NOTHING;

  -- Grupo 1200: Inversiones
  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system)
  VALUES (p_tenant_id, '1200', 'Inversiones', 'activo', 'debito', v_1000, 2, false, true)
  ON CONFLICT (tenant_id, code) DO NOTHING
  RETURNING id INTO v_1200;
  IF v_1200 IS NULL THEN SELECT id INTO v_1200 FROM public.accounts WHERE tenant_id = p_tenant_id AND code = '1200'; END IF;

  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system, description) VALUES
    (p_tenant_id, '1210', 'Fondo de reserva', 'activo', 'debito', v_1200, 3, true, true, 'Fondo de reserva Ley 675 Art. 35. Minimo 1% del presupuesto anual.'),
    (p_tenant_id, '1220', 'CDTs y depositos a termino', 'activo', 'debito', v_1200, 3, true, true, 'Certificados de deposito a termino fijo y similares.')
  ON CONFLICT (tenant_id, code) DO NOTHING;

  -- Grupo 1300: Propiedad, planta y equipo
  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system)
  VALUES (p_tenant_id, '1300', 'Propiedad, planta y equipo', 'activo', 'debito', v_1000, 2, false, true)
  ON CONFLICT (tenant_id, code) DO NOTHING
  RETURNING id INTO v_1300;
  IF v_1300 IS NULL THEN SELECT id INTO v_1300 FROM public.accounts WHERE tenant_id = p_tenant_id AND code = '1300'; END IF;

  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system, description) VALUES
    (p_tenant_id, '1310', 'Muebles y enseres', 'activo', 'debito', v_1300, 3, true, true, 'Mobiliario de zonas comunes, oficina de administracion.'),
    (p_tenant_id, '1320', 'Equipos de computo y comunicacion', 'activo', 'debito', v_1300, 3, true, true, 'Computadores, impresoras, radios, camaras.'),
    (p_tenant_id, '1390', 'Depreciacion acumulada', 'activo', 'credito', v_1300, 3, true, true, 'Cuenta contra. Acumula la depreciacion de PPE. Naturaleza credito.')
  ON CONFLICT (tenant_id, code) DO NOTHING;

  -- =============================================
  -- CLASE 2: PASIVOS (naturaleza credito)
  -- =============================================
  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system)
  VALUES (p_tenant_id, '2000', 'PASIVOS', 'pasivo', 'credito', NULL, 1, false, true)
  ON CONFLICT (tenant_id, code) DO NOTHING
  RETURNING id INTO v_2000;
  IF v_2000 IS NULL THEN SELECT id INTO v_2000 FROM public.accounts WHERE tenant_id = p_tenant_id AND code = '2000'; END IF;

  -- Grupo 2100: Pasivos corrientes
  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system)
  VALUES (p_tenant_id, '2100', 'Pasivos corrientes', 'pasivo', 'credito', v_2000, 2, false, true)
  ON CONFLICT (tenant_id, code) DO NOTHING
  RETURNING id INTO v_2100;
  IF v_2100 IS NULL THEN SELECT id INTO v_2100 FROM public.accounts WHERE tenant_id = p_tenant_id AND code = '2100'; END IF;

  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system, description) VALUES
    (p_tenant_id, '2110', 'Proveedores', 'pasivo', 'credito', v_2100, 3, true, true, 'Facturas por pagar a proveedores de bienes y servicios.'),
    (p_tenant_id, '2120', 'Servicios publicos por pagar', 'pasivo', 'credito', v_2100, 3, true, true, 'Agua, energia, gas, aseo, telefonia pendientes de pago.'),
    (p_tenant_id, '2130', 'Nomina y prestaciones por pagar', 'pasivo', 'credito', v_2100, 3, true, true, 'Salarios, primas, cesantias, vacaciones, parafiscales.'),
    (p_tenant_id, '2140', 'Retenciones y aportes por pagar', 'pasivo', 'credito', v_2100, 3, true, true, 'Retefuente, ICA, aportes seguridad social, parafiscales.'),
    (p_tenant_id, '2150', 'Anticipos recibidos', 'pasivo', 'credito', v_2100, 3, true, true, 'Pagos anticipados de cuotas o depositos por reservas.')
  ON CONFLICT (tenant_id, code) DO NOTHING;

  -- Grupo 2200: Pasivos no corrientes
  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system)
  VALUES (p_tenant_id, '2200', 'Pasivos no corrientes', 'pasivo', 'credito', v_2000, 2, false, true)
  ON CONFLICT (tenant_id, code) DO NOTHING
  RETURNING id INTO v_2200;
  IF v_2200 IS NULL THEN SELECT id INTO v_2200 FROM public.accounts WHERE tenant_id = p_tenant_id AND code = '2200'; END IF;

  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system, description) VALUES
    (p_tenant_id, '2210', 'Obligaciones a largo plazo', 'pasivo', 'credito', v_2200, 3, true, true, 'Creditos bancarios u obligaciones con vencimiento mayor a un ano.')
  ON CONFLICT (tenant_id, code) DO NOTHING;

  -- =============================================
  -- CLASE 3: PATRIMONIO (naturaleza credito)
  -- =============================================
  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system)
  VALUES (p_tenant_id, '3000', 'PATRIMONIO', 'patrimonio', 'credito', NULL, 1, false, true)
  ON CONFLICT (tenant_id, code) DO NOTHING
  RETURNING id INTO v_3000;
  IF v_3000 IS NULL THEN SELECT id INTO v_3000 FROM public.accounts WHERE tenant_id = p_tenant_id AND code = '3000'; END IF;

  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system, description) VALUES
    (p_tenant_id, '3100', 'Resultado del ejercicio', 'patrimonio', 'credito', v_3000, 2, true, true, 'Utilidad o perdida del periodo contable actual (ingresos - gastos).'),
    (p_tenant_id, '3200', 'Resultados de ejercicios anteriores', 'patrimonio', 'credito', v_3000, 2, true, true, 'Superavit o deficit acumulado de periodos anteriores.'),
    (p_tenant_id, '3300', 'Superavit por valorizacion', 'patrimonio', 'credito', v_3000, 2, true, true, 'Incremento en el valor de activos sobre su costo historico.')
  ON CONFLICT (tenant_id, code) DO NOTHING;

  -- =============================================
  -- CLASE 4: INGRESOS (naturaleza credito)
  -- =============================================
  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system)
  VALUES (p_tenant_id, '4000', 'INGRESOS', 'ingreso', 'credito', NULL, 1, false, true)
  ON CONFLICT (tenant_id, code) DO NOTHING
  RETURNING id INTO v_4000;
  IF v_4000 IS NULL THEN SELECT id INTO v_4000 FROM public.accounts WHERE tenant_id = p_tenant_id AND code = '4000'; END IF;

  -- Grupo 4100: Ingresos operacionales
  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system)
  VALUES (p_tenant_id, '4100', 'Ingresos operacionales', 'ingreso', 'credito', v_4000, 2, false, true)
  ON CONFLICT (tenant_id, code) DO NOTHING
  RETURNING id INTO v_4100;
  IF v_4100 IS NULL THEN SELECT id INTO v_4100 FROM public.accounts WHERE tenant_id = p_tenant_id AND code = '4100'; END IF;

  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system, description) VALUES
    (p_tenant_id, '4110', 'Cuotas de administracion ordinarias', 'ingreso', 'credito', v_4100, 3, true, true, 'Ingreso por cuotas mensuales ordinarias segun presupuesto aprobado.'),
    (p_tenant_id, '4120', 'Cuotas extraordinarias', 'ingreso', 'credito', v_4100, 3, true, true, 'Ingreso por cuotas extraordinarias aprobadas en asamblea.'),
    (p_tenant_id, '4130', 'Uso de zonas comunes', 'ingreso', 'credito', v_4100, 3, true, true, 'Ingresos por reserva y uso de salon social, BBQ, cancha, etc.'),
    (p_tenant_id, '4190', 'Otros ingresos operacionales', 'ingreso', 'credito', v_4100, 3, true, true, 'Multas, penalidades, publicidad en areas comunes, otros.')
  ON CONFLICT (tenant_id, code) DO NOTHING;

  -- Grupo 4200: Ingresos no operacionales
  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system)
  VALUES (p_tenant_id, '4200', 'Ingresos no operacionales', 'ingreso', 'credito', v_4000, 2, false, true)
  ON CONFLICT (tenant_id, code) DO NOTHING
  RETURNING id INTO v_4200;
  IF v_4200 IS NULL THEN SELECT id INTO v_4200 FROM public.accounts WHERE tenant_id = p_tenant_id AND code = '4200'; END IF;

  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system, description) VALUES
    (p_tenant_id, '4210', 'Intereses de mora', 'ingreso', 'credito', v_4200, 3, true, true, 'Intereses cobrados por mora en pago de cuotas de administracion.'),
    (p_tenant_id, '4220', 'Rendimientos financieros', 'ingreso', 'credito', v_4200, 3, true, true, 'Intereses de CDTs, cuentas de ahorro, fondo de reserva.'),
    (p_tenant_id, '4290', 'Otros ingresos no operacionales', 'ingreso', 'credito', v_4200, 3, true, true, 'Ingresos no recurrentes: indemnizaciones, donaciones, etc.')
  ON CONFLICT (tenant_id, code) DO NOTHING;

  -- =============================================
  -- CLASE 5: GASTOS (naturaleza debito)
  -- =============================================
  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system)
  VALUES (p_tenant_id, '5000', 'GASTOS', 'gasto', 'debito', NULL, 1, false, true)
  ON CONFLICT (tenant_id, code) DO NOTHING
  RETURNING id INTO v_5000;
  IF v_5000 IS NULL THEN SELECT id INTO v_5000 FROM public.accounts WHERE tenant_id = p_tenant_id AND code = '5000'; END IF;

  -- Grupo 5100: Gastos operacionales
  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system)
  VALUES (p_tenant_id, '5100', 'Gastos operacionales', 'gasto', 'debito', v_5000, 2, false, true)
  ON CONFLICT (tenant_id, code) DO NOTHING
  RETURNING id INTO v_5100;
  IF v_5100 IS NULL THEN SELECT id INTO v_5100 FROM public.accounts WHERE tenant_id = p_tenant_id AND code = '5100'; END IF;

  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system, description) VALUES
    (p_tenant_id, '5110', 'Nomina y prestaciones sociales', 'gasto', 'debito', v_5100, 3, true, true, 'Salarios, primas, cesantias, vacaciones, aportes del personal del conjunto.'),
    (p_tenant_id, '5120', 'Vigilancia y seguridad', 'gasto', 'debito', v_5100, 3, true, true, 'Contrato de vigilancia, monitoreo CCTV, control de acceso.'),
    (p_tenant_id, '5130', 'Aseo y limpieza', 'gasto', 'debito', v_5100, 3, true, true, 'Servicio de aseo de areas comunes, insumos de limpieza.'),
    (p_tenant_id, '5140', 'Mantenimiento y reparaciones', 'gasto', 'debito', v_5100, 3, true, true, 'Mantenimiento de ascensores, bombas, plantas electricas, pintura, plomeria.'),
    (p_tenant_id, '5150', 'Servicios publicos', 'gasto', 'debito', v_5100, 3, true, true, 'Agua, energia, gas, telefonia, internet de zonas comunes.'),
    (p_tenant_id, '5160', 'Seguros', 'gasto', 'debito', v_5100, 3, true, true, 'Poliza de areas comunes, responsabilidad civil, incendio, terremoto.'),
    (p_tenant_id, '5170', 'Gastos de administracion', 'gasto', 'debito', v_5100, 3, true, true, 'Honorarios administrador, papeleria, correo, transporte, capacitacion.'),
    (p_tenant_id, '5180', 'Gastos legales y juridicos', 'gasto', 'debito', v_5100, 3, true, true, 'Asesoria juridica, cobro coactivo, procesos legales.'),
    (p_tenant_id, '5190', 'Depreciacion', 'gasto', 'debito', v_5100, 3, true, true, 'Gasto por depreciacion periodica de propiedad, planta y equipo.')
  ON CONFLICT (tenant_id, code) DO NOTHING;

  -- Grupo 5200: Gastos no operacionales
  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system)
  VALUES (p_tenant_id, '5200', 'Gastos no operacionales', 'gasto', 'debito', v_5000, 2, false, true)
  ON CONFLICT (tenant_id, code) DO NOTHING
  RETURNING id INTO v_5200;
  IF v_5200 IS NULL THEN SELECT id INTO v_5200 FROM public.accounts WHERE tenant_id = p_tenant_id AND code = '5200'; END IF;

  INSERT INTO public.accounts (tenant_id, code, name, account_type, nature, parent_id, level, is_detail, is_system, description) VALUES
    (p_tenant_id, '5210', 'Comisiones y gastos bancarios', 'gasto', 'debito', v_5200, 3, true, true, 'Comisiones de transferencias, chequeras, manejo cuenta, gravamen financiero (4x1000).'),
    (p_tenant_id, '5220', 'Provision de cartera', 'gasto', 'debito', v_5200, 3, true, true, 'Gasto por provision de cartera incobrable segun antiguedad de la deuda.'),
    (p_tenant_id, '5290', 'Otros gastos no operacionales', 'gasto', 'debito', v_5200, 3, true, true, 'Gastos no recurrentes: sanciones, diferencias en cambio, perdidas.')
  ON CONFLICT (tenant_id, code) DO NOTHING;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.seed_chart_of_accounts IS 'Seeds the base NIIF Grupo 3 chart of accounts for a given tenant. Idempotent.';

-- NOTE: The pilot tenant seed call was moved to 021_seed_default_data.sql
-- to ensure the tenant exists before seeding accounts.
