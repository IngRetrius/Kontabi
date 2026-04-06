import { createClient } from "@/lib/supabase/client";
import { formatPercentage, formatCOP } from "@/lib/utils/format";
import type { HealthIndicator, HealthIndicatorLevel } from "@/types/database";

// -- Definitions -------------------------------------------------------------

interface IndicatorDef {
  key: string;
  name: string;
  description: string;
  greenMin: number;
  greenMax: number;
  yellowMin: number;
  yellowMax: number;
  invertColor?: boolean; // lower is better (e.g., cartera morosa, eficiencia admin)
  format: "percentage" | "months" | "ratio";
}

const INDICATOR_DEFS: IndicatorDef[] = [
  {
    key: "collection_rate",
    name: "Tasa de recaudo",
    description: "Cobrado / Facturado del periodo",
    greenMin: 90, greenMax: Infinity,
    yellowMin: 70, yellowMax: 90,
    format: "percentage",
  },
  {
    key: "liquidity",
    name: "Liquidez",
    description: "Caja disponible / Gasto mensual",
    greenMin: 3, greenMax: Infinity,
    yellowMin: 1, yellowMax: 3,
    format: "months",
  },
  {
    key: "budget_execution",
    name: "Ejecucion presupuestal",
    description: "Gasto real / Presupuesto",
    greenMin: 85, greenMax: 100,
    yellowMin: 100, yellowMax: 115,
    format: "percentage",
  },
  {
    key: "reserve_fund",
    name: "Fondo de reserva",
    description: "Saldo / Minimo legal",
    greenMin: 150, greenMax: Infinity,
    yellowMin: 100, yellowMax: 150,
    format: "percentage",
  },
  {
    key: "delinquency_rate",
    name: "Cartera morosa",
    description: "Mora / Facturado total",
    greenMin: 0, greenMax: 10,
    yellowMin: 10, yellowMax: 25,
    invertColor: true,
    format: "percentage",
  },
  {
    key: "admin_efficiency",
    name: "Eficiencia administrativa",
    description: "Gastos admin / Ingresos totales",
    greenMin: 0, greenMax: 15,
    yellowMin: 15, yellowMax: 25,
    invertColor: true,
    format: "percentage",
  },
];

export { INDICATOR_DEFS };

// -- Core --------------------------------------------------------------------

/**
 * Calculate all 6 health indicators for the current tenant.
 */
export async function calculateHealthIndicators(): Promise<{
  indicators: HealthIndicator[];
  error: string | null;
}> {
  const supabase = createClient();

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentPeriod = `${currentYear}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Fetch all needed data in parallel
    const [invoicesRes, budgetRes, reserveRes, balancesRes] = await Promise.all([
      // All invoices for current year
      supabase
        .from("invoices")
        .select("total, paid_amount, status, period, late_fee_amount")
        .gte("period", `${currentYear}-01`)
        .lte("period", `${currentYear}-12`),

      // Active budget
      supabase
        .from("budgets")
        .select("total")
        .eq("status", "active")
        .eq("year", currentYear)
        .single(),

      // Reserve fund
      supabase
        .from("reserve_fund")
        .select("current_balance, legal_minimum")
        .single(),

      // Account balances from journal entry lines for cash and expense accounts
      supabase
        .from("journal_entry_lines")
        .select("debit, credit, account:accounts!inner(code, nature)")
        .eq("account.is_active", true),
    ]);

    const invoices = invoicesRes.data ?? [];
    const budget = budgetRes.data;
    const reserve = reserveRes.data;
    const lines = balancesRes.data ?? [];

    // -- Calculate raw values --

    // 1. Collection rate: paid / billed
    const totalBilled = invoices.reduce((s, i) => s + Number(i.total), 0);
    const totalCollected = invoices.reduce((s, i) => s + Number(i.paid_amount), 0);
    const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 100;

    // 2. Liquidity: cash balance / monthly expense
    const cashBalance = lines
      .filter((l) => {
        const acc = l.account as unknown as { code: string; nature: string };
        return acc.code === "1110";
      })
      .reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);

    const monthlyBudget = budget ? Number(budget.total) / 12 : 1;
    const liquidityMonths = monthlyBudget > 0 ? cashBalance / monthlyBudget : 0;

    // 3. Budget execution: actual expenses / budgeted
    const actualExpenses = lines
      .filter((l) => {
        const acc = l.account as unknown as { code: string; nature: string };
        return acc.code.startsWith("5");
      })
      .reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);

    const budgetTotal = budget ? Number(budget.total) : 1;
    // Prorate budget to current month
    const monthsElapsed = now.getMonth() + 1;
    const proratedBudget = (budgetTotal / 12) * monthsElapsed;
    const executionPct = proratedBudget > 0 ? (actualExpenses / proratedBudget) * 100 : 0;

    // 4. Reserve fund: balance / legal minimum
    const reserveBalance = reserve ? Number(reserve.current_balance) : 0;
    const reserveMinimum = reserve ? Number(reserve.legal_minimum) : 1;
    const reservePct = reserveMinimum > 0 ? (reserveBalance / reserveMinimum) * 100 : 0;

    // 5. Delinquency: overdue amount / total billed
    const overdueAmount = invoices
      .filter((i) => i.status === "overdue")
      .reduce((s, i) => s + (Number(i.total) - Number(i.paid_amount)), 0);
    const delinquencyRate = totalBilled > 0 ? (overdueAmount / totalBilled) * 100 : 0;

    // 6. Admin efficiency: admin expenses / total income
    const adminExpenses = lines
      .filter((l) => {
        const acc = l.account as unknown as { code: string; nature: string };
        return acc.code.startsWith("517");
      })
      .reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0);

    const totalIncome = lines
      .filter((l) => {
        const acc = l.account as unknown as { code: string; nature: string };
        return acc.code.startsWith("4");
      })
      .reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0);

    const adminEfficiency = totalIncome > 0 ? (adminExpenses / totalIncome) * 100 : 0;

    // -- Build indicators --
    const rawValues: Record<string, number> = {
      collection_rate: Math.round(collectionRate * 10) / 10,
      liquidity: Math.round(liquidityMonths * 10) / 10,
      budget_execution: Math.round(executionPct * 10) / 10,
      reserve_fund: Math.round(reservePct * 10) / 10,
      delinquency_rate: Math.round(delinquencyRate * 10) / 10,
      admin_efficiency: Math.round(adminEfficiency * 10) / 10,
    };

    const indicators: HealthIndicator[] = INDICATOR_DEFS.map((def) => {
      const value = rawValues[def.key] ?? 0;
      return {
        key: def.key,
        name: def.name,
        value,
        formatted: formatValue(value, def.format),
        level: getLevel(value, def),
        description: def.description,
      };
    });

    return { indicators, error: null };
  } catch (err) {
    return { indicators: [], error: (err as Error).message };
  }
}

/**
 * Get a narrative summary of overall health.
 */
export function getHealthSummary(indicators: HealthIndicator[]): {
  level: HealthIndicatorLevel;
  narrative: string;
} {
  const redCount = indicators.filter((i) => i.level === "red").length;
  const yellowCount = indicators.filter((i) => i.level === "yellow").length;

  if (redCount >= 2) {
    return {
      level: "red",
      narrative: `La salud financiera del conjunto es critica. ${redCount} indicadores en rojo requieren atencion inmediata.`,
    };
  }
  if (redCount >= 1 || yellowCount >= 3) {
    return {
      level: "yellow",
      narrative: `La salud financiera del conjunto requiere atencion. ${redCount} indicadores en rojo y ${yellowCount} en amarillo.`,
    };
  }
  return {
    level: "green",
    narrative: "La salud financiera del conjunto es buena. Todos los indicadores estan dentro de rangos aceptables.",
  };
}

// -- Helpers -----------------------------------------------------------------

function getLevel(value: number, def: IndicatorDef): HealthIndicatorLevel {
  if (def.invertColor) {
    // Lower is better
    if (value >= def.greenMin && value <= def.greenMax) return "green";
    if (value > def.yellowMin && value <= def.yellowMax) return "yellow";
    return "red";
  }

  // Higher is better (or within range)
  if (def.key === "budget_execution") {
    // Special: green is 85-100%, yellow 100-115%, red >115% or <85%
    if (value >= 85 && value <= 100) return "green";
    if ((value > 100 && value <= 115) || (value >= 70 && value < 85)) return "yellow";
    return "red";
  }

  if (value >= def.greenMin) return "green";
  if (value >= def.yellowMin) return "yellow";
  return "red";
}

function formatValue(value: number, format: string): string {
  switch (format) {
    case "percentage":
      return formatPercentage(value);
    case "months":
      return `${value} meses`;
    case "ratio":
      return `${value}x`;
    default:
      return String(value);
  }
}
