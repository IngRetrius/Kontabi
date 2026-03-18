-- 017_create_nls_tables.sql
-- Natural Language System (NLS) for translating accounting operations
-- to plain Spanish. Templates per operation type and three levels
-- (summary, detail, accounting). Dictionary of accounting terms.

-- =============================================
-- TABLE: narrative_templates
-- =============================================

CREATE TABLE IF NOT EXISTS public.narrative_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  operation_type TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('summary', 'detail', 'accounting')),
  template TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, operation_type, level)
);

COMMENT ON TABLE public.narrative_templates IS 'Templates NLS por tipo de operacion y nivel. tenant_id NULL = templates globales por defecto. Si un tenant tiene su propio template, tiene prioridad.';
COMMENT ON COLUMN public.narrative_templates.template IS 'Template con placeholders: {unit}, {period}, {amount}, {supplier}, {concept}, {balance}, {months}, {method}, {reference}, {account_debit}, {account_credit}, {entry_number}.';

CREATE INDEX idx_narrative_templates_lookup
  ON public.narrative_templates (operation_type, level, tenant_id);

CREATE TRIGGER trg_narrative_templates_updated_at
  BEFORE UPDATE ON public.narrative_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.narrative_templates ENABLE ROW LEVEL SECURITY;

-- Global templates (tenant_id IS NULL) are visible to all
CREATE POLICY "Users can view global templates"
  ON public.narrative_templates FOR SELECT
  USING (tenant_id IS NULL);

CREATE POLICY "Users can view templates in their tenant"
  ON public.narrative_templates FOR SELECT
  USING (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can insert templates in their tenant"
  ON public.narrative_templates FOR INSERT
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can update templates in their tenant"
  ON public.narrative_templates FOR UPDATE
  USING (tenant_id = public.get_current_tenant_id())
  WITH CHECK (tenant_id = public.get_current_tenant_id());

CREATE POLICY "Users can delete templates in their tenant"
  ON public.narrative_templates FOR DELETE
  USING (tenant_id = public.get_current_tenant_id());

CREATE TRIGGER trg_narrative_templates_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.narrative_templates
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- =============================================
-- TABLE: nls_dictionary
-- =============================================

CREATE TABLE IF NOT EXISTS public.nls_dictionary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accounting_term TEXT NOT NULL UNIQUE,
  simple_translation TEXT NOT NULL,
  example TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.nls_dictionary IS 'Diccionario de terminos contables traducidos a espanol simple. Global, no por tenant.';

CREATE INDEX idx_nls_dictionary_category ON public.nls_dictionary (category);
CREATE INDEX idx_nls_dictionary_term ON public.nls_dictionary (accounting_term);

-- Dictionary is global (no tenant_id), read-only for all authenticated users
ALTER TABLE public.nls_dictionary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view dictionary"
  ON public.nls_dictionary FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- =============================================
-- SEED: Global NLS templates (tenant_id = NULL)
-- These are defaults; tenants can override with their own.
-- =============================================

-- Placeholders available:
-- {unit}       - Unidad (e.g., "Apto 301")
-- {period}     - Periodo (e.g., "Marzo 2026")
-- {amount}     - Monto formateado (e.g., "$350.000")
-- {supplier}   - Nombre del proveedor
-- {concept}    - Concepto o descripcion
-- {balance}    - Saldo resultante
-- {months}     - Numero de meses (mora)
-- {method}     - Metodo de pago
-- {reference}  - Numero de referencia
-- {account_debit}  - Cuenta debito (codigo + nombre)
-- {account_credit} - Cuenta credito (codigo + nombre)
-- {entry_number}   - Numero de asiento

-- quota_payment: Pago de cuota ordinaria de administracion
INSERT INTO public.narrative_templates (tenant_id, operation_type, level, template) VALUES
  (NULL, 'quota_payment', 'summary', 'Pago recibido: {unit} pago cuota de {period} por {amount}'),
  (NULL, 'quota_payment', 'detail', 'Se recibio pago de {amount} de {unit} correspondiente a la cuota de administracion de {period}. Metodo: {method}. Ref: {reference}'),
  (NULL, 'quota_payment', 'accounting', 'Asiento #{entry_number}: DB {account_debit} / CR {account_credit} por {amount}. Pago cuota {unit} periodo {period}')
ON CONFLICT (tenant_id, operation_type, level) DO NOTHING;

-- extraordinary_payment: Pago de cuota extraordinaria
INSERT INTO public.narrative_templates (tenant_id, operation_type, level, template) VALUES
  (NULL, 'extraordinary_payment', 'summary', 'Pago recibido: {unit} pago cuota extraordinaria por {amount}'),
  (NULL, 'extraordinary_payment', 'detail', 'Se recibio pago de {amount} de {unit} por concepto de cuota extraordinaria: {concept}. Metodo: {method}. Ref: {reference}'),
  (NULL, 'extraordinary_payment', 'accounting', 'Asiento #{entry_number}: DB {account_debit} / CR {account_credit} por {amount}. Cuota extraordinaria {unit}: {concept}')
ON CONFLICT (tenant_id, operation_type, level) DO NOTHING;

-- supplier_payment: Pago a proveedor
INSERT INTO public.narrative_templates (tenant_id, operation_type, level, template) VALUES
  (NULL, 'supplier_payment', 'summary', 'Pago realizado: se pago {amount} a {supplier} por {concept}'),
  (NULL, 'supplier_payment', 'detail', 'Se realizo pago de {amount} al proveedor {supplier} por concepto de {concept}. Metodo: {method}. Ref: {reference}. Saldo en banco: {balance}'),
  (NULL, 'supplier_payment', 'accounting', 'Asiento #{entry_number}: DB {account_debit} / CR {account_credit} por {amount}. Pago a {supplier}: {concept}')
ON CONFLICT (tenant_id, operation_type, level) DO NOTHING;

-- utility_payment: Pago de servicios publicos
INSERT INTO public.narrative_templates (tenant_id, operation_type, level, template) VALUES
  (NULL, 'utility_payment', 'summary', 'Pago de servicios: {concept} por {amount}'),
  (NULL, 'utility_payment', 'detail', 'Se pago {amount} por concepto de {concept}. Metodo: {method}. Ref: {reference}. Saldo en banco: {balance}'),
  (NULL, 'utility_payment', 'accounting', 'Asiento #{entry_number}: DB {account_debit} / CR {account_credit} por {amount}. Servicio publico: {concept}')
ON CONFLICT (tenant_id, operation_type, level) DO NOTHING;

-- payroll: Pago de nomina
INSERT INTO public.narrative_templates (tenant_id, operation_type, level, template) VALUES
  (NULL, 'payroll', 'summary', 'Pago de nomina: {amount} del periodo {period}'),
  (NULL, 'payroll', 'detail', 'Se pago nomina de {period} por {amount}. Incluye salarios y prestaciones del personal del conjunto. Metodo: {method}'),
  (NULL, 'payroll', 'accounting', 'Asiento #{entry_number}: DB {account_debit} / CR {account_credit} por {amount}. Nomina {period}')
ON CONFLICT (tenant_id, operation_type, level) DO NOTHING;

-- reserve_fund_contribution: Aporte al fondo de reserva
INSERT INTO public.narrative_templates (tenant_id, operation_type, level, template) VALUES
  (NULL, 'reserve_fund_contribution', 'summary', 'Fondo de reserva: se aportaron {amount}. Saldo: {balance}'),
  (NULL, 'reserve_fund_contribution', 'detail', 'Se traslado {amount} al fondo de reserva (Ley 675 Art. 35). Saldo actual del fondo: {balance}. Corresponde al periodo {period}'),
  (NULL, 'reserve_fund_contribution', 'accounting', 'Asiento #{entry_number}: DB {account_debit} / CR {account_credit} por {amount}. Aporte fondo reserva {period}')
ON CONFLICT (tenant_id, operation_type, level) DO NOTHING;

-- late_interest: Intereses de mora generados
INSERT INTO public.narrative_templates (tenant_id, operation_type, level, template) VALUES
  (NULL, 'late_interest', 'summary', 'Intereses de mora: {amount} generados para {unit} ({months} meses pendientes)'),
  (NULL, 'late_interest', 'detail', 'Se generaron {amount} en intereses de mora para {unit}. Deuda acumulada de {months} meses. Tasa aplicada segun configuracion del conjunto'),
  (NULL, 'late_interest', 'accounting', 'Asiento #{entry_number}: DB {account_debit} / CR {account_credit} por {amount}. Intereses mora {unit}, {months} meses')
ON CONFLICT (tenant_id, operation_type, level) DO NOTHING;

-- common_area_rental: Ingreso por uso de zonas comunes
INSERT INTO public.narrative_templates (tenant_id, operation_type, level, template) VALUES
  (NULL, 'common_area_rental', 'summary', 'Ingreso zona comun: {amount} por uso de {concept}'),
  (NULL, 'common_area_rental', 'detail', 'Se recibio {amount} por reserva de {concept}. Reservado por {unit}. Ref: {reference}'),
  (NULL, 'common_area_rental', 'accounting', 'Asiento #{entry_number}: DB {account_debit} / CR {account_credit} por {amount}. Reserva {concept}')
ON CONFLICT (tenant_id, operation_type, level) DO NOTHING;

-- bank_fee: Comisiones y gastos bancarios
INSERT INTO public.narrative_templates (tenant_id, operation_type, level, template) VALUES
  (NULL, 'bank_fee', 'summary', 'Gasto bancario: {amount} por {concept}'),
  (NULL, 'bank_fee', 'detail', 'Se debito {amount} de la cuenta bancaria por concepto de {concept}. Ref: {reference}. Saldo: {balance}'),
  (NULL, 'bank_fee', 'accounting', 'Asiento #{entry_number}: DB {account_debit} / CR {account_credit} por {amount}. Gasto bancario: {concept}')
ON CONFLICT (tenant_id, operation_type, level) DO NOTHING;

-- maintenance: Gastos de mantenimiento
INSERT INTO public.narrative_templates (tenant_id, operation_type, level, template) VALUES
  (NULL, 'maintenance', 'summary', 'Mantenimiento: {amount} por {concept}'),
  (NULL, 'maintenance', 'detail', 'Se pago {amount} por mantenimiento: {concept}. Proveedor: {supplier}. Metodo: {method}. Ref: {reference}'),
  (NULL, 'maintenance', 'accounting', 'Asiento #{entry_number}: DB {account_debit} / CR {account_credit} por {amount}. Mantenimiento: {concept}')
ON CONFLICT (tenant_id, operation_type, level) DO NOTHING;

-- security: Gastos de vigilancia
INSERT INTO public.narrative_templates (tenant_id, operation_type, level, template) VALUES
  (NULL, 'security', 'summary', 'Vigilancia: pago de {amount} del periodo {period}'),
  (NULL, 'security', 'detail', 'Se pago {amount} al proveedor de vigilancia {supplier} por el periodo {period}. Metodo: {method}. Ref: {reference}'),
  (NULL, 'security', 'accounting', 'Asiento #{entry_number}: DB {account_debit} / CR {account_credit} por {amount}. Vigilancia {period}')
ON CONFLICT (tenant_id, operation_type, level) DO NOTHING;

-- cleaning: Gastos de aseo
INSERT INTO public.narrative_templates (tenant_id, operation_type, level, template) VALUES
  (NULL, 'cleaning', 'summary', 'Aseo: pago de {amount} del periodo {period}'),
  (NULL, 'cleaning', 'detail', 'Se pago {amount} por servicio de aseo y limpieza. Proveedor: {supplier}. Periodo: {period}. Metodo: {method}'),
  (NULL, 'cleaning', 'accounting', 'Asiento #{entry_number}: DB {account_debit} / CR {account_credit} por {amount}. Aseo {period}')
ON CONFLICT (tenant_id, operation_type, level) DO NOTHING;

-- insurance: Gastos de seguros
INSERT INTO public.narrative_templates (tenant_id, operation_type, level, template) VALUES
  (NULL, 'insurance', 'summary', 'Seguros: pago de poliza por {amount}'),
  (NULL, 'insurance', 'detail', 'Se pago {amount} por concepto de seguros: {concept}. Proveedor: {supplier}. Metodo: {method}. Ref: {reference}'),
  (NULL, 'insurance', 'accounting', 'Asiento #{entry_number}: DB {account_debit} / CR {account_credit} por {amount}. Seguros: {concept}')
ON CONFLICT (tenant_id, operation_type, level) DO NOTHING;

-- depreciation: Depreciacion de activos
INSERT INTO public.narrative_templates (tenant_id, operation_type, level, template) VALUES
  (NULL, 'depreciation', 'summary', 'Depreciacion: {amount} del periodo {period}'),
  (NULL, 'depreciation', 'detail', 'Se registro depreciacion de {amount} correspondiente al periodo {period}. Concepto: {concept}'),
  (NULL, 'depreciation', 'accounting', 'Asiento #{entry_number}: DB {account_debit} / CR {account_credit} por {amount}. Depreciacion {period}')
ON CONFLICT (tenant_id, operation_type, level) DO NOTHING;

-- legal: Gastos legales
INSERT INTO public.narrative_templates (tenant_id, operation_type, level, template) VALUES
  (NULL, 'legal', 'summary', 'Gasto legal: {amount} por {concept}'),
  (NULL, 'legal', 'detail', 'Se pago {amount} por concepto de gastos legales: {concept}. Proveedor: {supplier}. Metodo: {method}'),
  (NULL, 'legal', 'accounting', 'Asiento #{entry_number}: DB {account_debit} / CR {account_credit} por {amount}. Gasto legal: {concept}')
ON CONFLICT (tenant_id, operation_type, level) DO NOTHING;

-- admin_expense: Gastos de administracion
INSERT INTO public.narrative_templates (tenant_id, operation_type, level, template) VALUES
  (NULL, 'admin_expense', 'summary', 'Gasto administrativo: {amount} por {concept}'),
  (NULL, 'admin_expense', 'detail', 'Se pago {amount} por gasto de administracion: {concept}. Metodo: {method}. Ref: {reference}'),
  (NULL, 'admin_expense', 'accounting', 'Asiento #{entry_number}: DB {account_debit} / CR {account_credit} por {amount}. Gasto admin: {concept}')
ON CONFLICT (tenant_id, operation_type, level) DO NOTHING;

-- other_income: Otros ingresos
INSERT INTO public.narrative_templates (tenant_id, operation_type, level, template) VALUES
  (NULL, 'other_income', 'summary', 'Ingreso recibido: {amount} por {concept}'),
  (NULL, 'other_income', 'detail', 'Se recibio {amount} por concepto de {concept}. Metodo: {method}. Ref: {reference}'),
  (NULL, 'other_income', 'accounting', 'Asiento #{entry_number}: DB {account_debit} / CR {account_credit} por {amount}. Otro ingreso: {concept}')
ON CONFLICT (tenant_id, operation_type, level) DO NOTHING;

-- other_expense: Otros gastos
INSERT INTO public.narrative_templates (tenant_id, operation_type, level, template) VALUES
  (NULL, 'other_expense', 'summary', 'Gasto registrado: {amount} por {concept}'),
  (NULL, 'other_expense', 'detail', 'Se pago {amount} por concepto de {concept}. Metodo: {method}. Ref: {reference}'),
  (NULL, 'other_expense', 'accounting', 'Asiento #{entry_number}: DB {account_debit} / CR {account_credit} por {amount}. Otro gasto: {concept}')
ON CONFLICT (tenant_id, operation_type, level) DO NOTHING;

-- adjustment: Ajuste contable
INSERT INTO public.narrative_templates (tenant_id, operation_type, level, template) VALUES
  (NULL, 'adjustment', 'summary', 'Ajuste contable: {amount} - {concept}'),
  (NULL, 'adjustment', 'detail', 'Se registro ajuste contable por {amount}. Motivo: {concept}. Autorizado por administracion'),
  (NULL, 'adjustment', 'accounting', 'Asiento #{entry_number}: DB {account_debit} / CR {account_credit} por {amount}. Ajuste: {concept}')
ON CONFLICT (tenant_id, operation_type, level) DO NOTHING;

-- =============================================
-- SEED: NLS Dictionary
-- =============================================

INSERT INTO public.nls_dictionary (accounting_term, simple_translation, example, category) VALUES
  -- Conceptos fundamentales
  ('debito', 'Entrada de dinero o aumento de lo que nos deben', 'Cuando un residente paga su cuota, el dinero entra al banco (debito en bancos)', 'fundamental'),
  ('credito', 'Salida de dinero o registro de un ingreso', 'Cuando se paga al vigilante, sale dinero del banco (credito en bancos)', 'fundamental'),
  ('asiento contable', 'Registro financiero', 'Cada vez que entra o sale dinero se crea un registro financiero equilibrado', 'fundamental'),
  ('partida doble', 'Movimiento equilibrado', 'Todo peso que entra por un lado debe salir por otro: el sistema siempre esta en equilibrio', 'fundamental'),
  ('balance', 'Saldo o resultado', 'El saldo de la cuenta de bancos muestra cuanto dinero hay disponible', 'fundamental'),

  -- Tipos de cuenta
  ('activo', 'Lo que tenemos o nos deben', 'Dinero en banco, cuentas por cobrar, equipos del conjunto', 'tipo_cuenta'),
  ('pasivo', 'Lo que debemos', 'Facturas de proveedores pendientes, nomina por pagar', 'tipo_cuenta'),
  ('patrimonio', 'El resultado acumulado', 'La diferencia entre lo que tenemos y lo que debemos, acumulado de todos los anos', 'tipo_cuenta'),
  ('ingreso', 'Dinero que entra al conjunto', 'Cuotas de administracion, uso de zonas comunes, intereses de mora', 'tipo_cuenta'),
  ('gasto', 'Dinero que sale del conjunto', 'Vigilancia, aseo, mantenimiento, servicios publicos, nomina', 'tipo_cuenta'),

  -- Cuentas comunes
  ('cuenta por cobrar', 'Deuda que nos deben', 'Cuando un residente no paga su cuota, queda registrada como deuda pendiente', 'cuenta'),
  ('cuenta por pagar', 'Deuda que debemos', 'La factura del servicio de vigilancia que aun no se ha pagado', 'cuenta'),
  ('provision de cartera', 'Reserva por deudas dificiles de cobrar', 'Si un residente lleva 6 meses sin pagar, se reserva ese monto como posible perdida', 'cuenta'),
  ('depreciacion', 'Desgaste de equipos y muebles', 'Los equipos de computo pierden valor cada ano; esto se registra como gasto', 'cuenta'),
  ('fondo de reserva', 'Ahorro obligatorio del conjunto', 'La Ley 675 exige que el conjunto ahorre minimo el 1% del presupuesto anual', 'cuenta'),

  -- Operaciones
  ('conciliacion bancaria', 'Verificar que los registros coincidan con el extracto del banco', 'Se compara lo que dice el banco con lo que registra el sistema para encontrar diferencias', 'operacion'),
  ('cierre de periodo', 'Cerrar las cuentas del mes para que no se modifiquen', 'Al cerrar marzo, ya no se pueden hacer cambios en los registros de ese mes', 'operacion'),
  ('causacion', 'Registrar un gasto o ingreso cuando ocurre, no cuando se paga', 'La cuota de marzo se registra en marzo aunque el residente pague en abril', 'operacion'),
  ('amortizacion', 'Distribuir un pago grande en varios periodos', 'El seguro anual de $12M se distribuye como $1M por mes', 'operacion'),

  -- Reportes
  ('balance general', 'Foto financiera del conjunto en un momento dado', 'Muestra cuanto tiene el conjunto (activos), cuanto debe (pasivos) y el resultado (patrimonio)', 'reporte'),
  ('estado de resultados', 'Resumen de ingresos vs gastos en un periodo', 'Muestra si en el mes entro mas dinero del que salio (superavit) o viceversa (deficit)', 'reporte'),
  ('flujo de caja', 'Movimiento real del dinero', 'Cuanto dinero efectivo entro y salio en el mes, sin importar cuando se causo', 'reporte'),
  ('libro diario', 'Lista de todos los registros financieros', 'Cada movimiento de dinero queda en el libro diario con fecha, cuentas y montos', 'reporte'),

  -- Ley 675
  ('cuota ordinaria', 'Pago mensual del residente para el funcionamiento del conjunto', 'La cuota se calcula segun el presupuesto anual dividido entre las unidades, ajustado por coeficiente', 'ley675'),
  ('cuota extraordinaria', 'Pago adicional aprobado por la asamblea', 'Si hay una reparacion urgente que no estaba en el presupuesto, la asamblea puede aprobar un pago extra', 'ley675'),
  ('coeficiente de copropiedad', 'Porcentaje que le corresponde a cada unidad', 'Un apartamento grande tiene un coeficiente mayor y paga mas cuota que uno pequeno', 'ley675'),
  ('superavit', 'Cuando los ingresos superan los gastos', 'Si el conjunto recaudo $50M y gasto $45M, hay un superavit de $5M', 'ley675'),
  ('deficit', 'Cuando los gastos superan los ingresos', 'Si el conjunto recaudo $45M y gasto $50M, hay un deficit de $5M que debe cubrirse', 'ley675')
ON CONFLICT (accounting_term) DO NOTHING;
