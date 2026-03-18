import type { TransactionType } from "@/types/database";

// -- Types -------------------------------------------------------------------

export interface AccountMapping {
  debitCode: string;
  creditCode: string;
  description: string;
}

// -- Mappings ----------------------------------------------------------------

/**
 * Maps each transaction type to its default debit and credit accounts.
 *
 * Accounting rules for Colombian PH (NIIF Grupo 3):
 *
 * INGRESOS (entradas de dinero al conjunto):
 *   DB: cuenta de activo que recibe (banco, CxC)
 *   CR: cuenta de ingreso que se genera
 *
 * GASTOS (salidas de dinero del conjunto):
 *   DB: cuenta de gasto
 *   CR: cuenta de activo que disminuye (banco)
 *
 * MOVIMIENTOS INTERNOS (traslados entre cuentas de activo):
 *   DB: activo que recibe
 *   CR: activo que entrega
 */
export const TRANSACTION_MAPPINGS: Record<TransactionType, AccountMapping> = {
  // --- Ingresos ---

  quota_payment: {
    debitCode: "1110", // Bancos (entra dinero)
    creditCode: "4110", // Cuotas de administracion (ingreso)
    description: "Pago de cuota de administracion ordinaria",
  },

  extraordinary_payment: {
    debitCode: "1110", // Bancos
    creditCode: "4120", // Cuotas extraordinarias (ingreso)
    description: "Pago de cuota extraordinaria",
  },

  late_interest: {
    debitCode: "1150", // CxC intereses de mora
    creditCode: "4210", // Intereses de mora (ingreso)
    description: "Causacion de intereses por mora",
  },

  common_area_rental: {
    debitCode: "1110", // Bancos
    creditCode: "4130", // Uso zonas comunes (ingreso)
    description: "Ingreso por reserva de zona comun",
  },

  other_income: {
    debitCode: "1110", // Bancos
    creditCode: "4290", // Otros ingresos no operacionales
    description: "Otro ingreso",
  },

  // --- Gastos operacionales ---

  supplier_payment: {
    debitCode: "2110", // Proveedores (se reduce el pasivo)
    creditCode: "1110", // Bancos (sale dinero)
    description: "Pago a proveedor",
  },

  utility_payment: {
    debitCode: "5150", // Servicios publicos (gasto)
    creditCode: "1110", // Bancos
    description: "Pago de servicio publico",
  },

  payroll: {
    debitCode: "5110", // Nomina (gasto)
    creditCode: "1110", // Bancos
    description: "Pago de nomina y prestaciones",
  },

  security: {
    debitCode: "5120", // Vigilancia (gasto)
    creditCode: "1110", // Bancos
    description: "Pago de vigilancia y seguridad",
  },

  cleaning: {
    debitCode: "5130", // Aseo (gasto)
    creditCode: "1110", // Bancos
    description: "Pago de aseo y limpieza",
  },

  maintenance: {
    debitCode: "5140", // Mantenimiento (gasto)
    creditCode: "1110", // Bancos
    description: "Pago de mantenimiento",
  },

  insurance: {
    debitCode: "5160", // Seguros (gasto)
    creditCode: "1110", // Bancos
    description: "Pago de poliza de seguros",
  },

  admin_expense: {
    debitCode: "5170", // Gastos admin (gasto)
    creditCode: "1110", // Bancos
    description: "Gasto de administracion",
  },

  legal: {
    debitCode: "5180", // Gastos legales (gasto)
    creditCode: "1110", // Bancos
    description: "Gasto legal o juridico",
  },

  // --- Gastos no operacionales ---

  bank_fee: {
    debitCode: "5210", // Comisiones bancarias (gasto)
    creditCode: "1110", // Bancos
    description: "Comision o gasto bancario",
  },

  depreciation: {
    debitCode: "5190", // Depreciacion (gasto)
    creditCode: "1390", // Depreciacion acumulada (contra-activo)
    description: "Depreciacion periodica de activos",
  },

  other_expense: {
    debitCode: "5290", // Otros gastos no operacionales
    creditCode: "1110", // Bancos
    description: "Otro gasto",
  },

  // --- Movimientos internos ---

  reserve_fund_contribution: {
    debitCode: "1210", // Fondo de reserva (activo)
    creditCode: "1110", // Bancos (sale de banco, entra al fondo)
    description: "Aporte al fondo de reserva Ley 675",
  },

  // --- Ajustes ---

  adjustment: {
    debitCode: "1110", // Default, se puede override
    creditCode: "1110", // Default, se puede override
    description: "Ajuste contable manual",
  },
};

/**
 * Get the account mapping for a transaction type.
 * For adjustments, the caller should provide custom account codes.
 */
export function getMapping(type: TransactionType): AccountMapping {
  return TRANSACTION_MAPPINGS[type];
}

/**
 * Get all transaction types grouped by category for the UI.
 */
export const TRANSACTION_CATEGORIES = {
  ingresos: {
    label: "Ingresos",
    types: [
      { type: "quota_payment" as const, label: "Pago cuota administracion" },
      { type: "extraordinary_payment" as const, label: "Pago cuota extraordinaria" },
      { type: "late_interest" as const, label: "Intereses de mora" },
      { type: "common_area_rental" as const, label: "Ingreso zona comun" },
      { type: "other_income" as const, label: "Otro ingreso" },
    ],
  },
  gastos_operacionales: {
    label: "Gastos operacionales",
    types: [
      { type: "payroll" as const, label: "Nomina y prestaciones" },
      { type: "security" as const, label: "Vigilancia" },
      { type: "cleaning" as const, label: "Aseo y limpieza" },
      { type: "maintenance" as const, label: "Mantenimiento" },
      { type: "utility_payment" as const, label: "Servicios publicos" },
      { type: "insurance" as const, label: "Seguros" },
      { type: "admin_expense" as const, label: "Gasto administrativo" },
      { type: "legal" as const, label: "Gasto legal" },
      { type: "supplier_payment" as const, label: "Pago a proveedor" },
    ],
  },
  gastos_no_operacionales: {
    label: "Gastos no operacionales",
    types: [
      { type: "bank_fee" as const, label: "Comision bancaria" },
      { type: "depreciation" as const, label: "Depreciacion" },
      { type: "other_expense" as const, label: "Otro gasto" },
    ],
  },
  otros: {
    label: "Otros movimientos",
    types: [
      { type: "reserve_fund_contribution" as const, label: "Aporte fondo reserva" },
      { type: "adjustment" as const, label: "Ajuste contable" },
    ],
  },
} as const;

/**
 * Get a human-readable label for a transaction type.
 */
export function getTransactionLabel(type: TransactionType): string {
  for (const category of Object.values(TRANSACTION_CATEGORIES)) {
    const found = category.types.find((t) => t.type === type);
    if (found) return found.label;
  }
  return type;
}
