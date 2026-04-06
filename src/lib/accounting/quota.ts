import { createClient } from "@/lib/supabase/client";
import type { Unit, Budget, BudgetItem } from "@/types/database";

// -- Types -------------------------------------------------------------------

export interface UnitQuota {
  unitId: string;
  unitNumber: string;
  unitType: string;
  coefficient: number;
  monthlyQuota: number;
  previousQuota: number | null;
  difference: number | null;
}

export interface QuotaDistribution {
  monthlyExpense: number;
  quotas: UnitQuota[];
  totalDistributed: number;
  balanceDifference: number;
}

// -- Helpers -----------------------------------------------------------------

async function getTenantId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("auth_id", user.id)
    .single();

  return data?.tenant_id ?? null;
}

// -- Core logic --------------------------------------------------------------

/**
 * Calculate monthly quota per unit based on the active budget and coefficients.
 *
 * Formula:
 *   monthly_expense = budget.total / 12
 *   unit_quota = monthly_expense * unit.coefficient
 *
 * Some items can be distributed equally (not by coefficient). This is
 * controlled by the `equalItems` parameter which lists budget item IDs
 * that should be split evenly across all active units.
 */
export async function calculateQuotaDistribution(
  budgetId: string,
  equalItemIds: string[] = []
): Promise<{ distribution: QuotaDistribution | null; error: string | null }> {
  const supabase = createClient();
  const tenantId = await getTenantId();
  if (!tenantId) {
    return { distribution: null, error: "No hay sesion activa" };
  }

  // Fetch budget
  const { data: budget, error: budgetError } = await supabase
    .from("budgets")
    .select("*")
    .eq("id", budgetId)
    .single();

  if (budgetError || !budget) {
    return { distribution: null, error: "Presupuesto no encontrado" };
  }

  // Fetch budget items
  const { data: items } = await supabase
    .from("budget_items")
    .select("*")
    .eq("budget_id", budgetId);

  const budgetItems = (items ?? []) as BudgetItem[];

  // Separate coefficient-based vs equal distribution items
  let coefficientAnnual = 0;
  let equalAnnual = 0;

  for (const item of budgetItems) {
    if (equalItemIds.includes(item.id)) {
      equalAnnual += item.annual_amount;
    } else {
      coefficientAnnual += item.annual_amount;
    }
  }

  const coefficientMonthly = coefficientAnnual / 12;
  const equalMonthly = equalAnnual / 12;

  // Fetch active units
  const { data: units } = await supabase
    .from("units")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("number");

  const activeUnits = (units ?? []) as Unit[];

  if (activeUnits.length === 0) {
    return { distribution: null, error: "No hay unidades activas" };
  }

  const equalPerUnit = activeUnits.length > 0 ? equalMonthly / activeUnits.length : 0;

  // Calculate quotas
  const quotas: UnitQuota[] = activeUnits.map((unit) => {
    const byCoefficient = coefficientMonthly * unit.coefficient;
    const monthlyQuota = Math.round(byCoefficient + equalPerUnit);

    return {
      unitId: unit.id,
      unitNumber: unit.number,
      unitType: unit.unit_type,
      coefficient: unit.coefficient,
      monthlyQuota,
      previousQuota: null,
      difference: null,
    };
  });

  const totalDistributed = quotas.reduce((sum, q) => sum + q.monthlyQuota, 0);
  const monthlyExpense = (budget as Budget).total / 12;

  return {
    distribution: {
      monthlyExpense: Math.round(monthlyExpense),
      quotas,
      totalDistributed,
      balanceDifference: Math.round(monthlyExpense - totalDistributed),
    },
    error: null,
  };
}

/**
 * Fetch previous period quotas for comparison.
 */
export async function getPreviousQuotas(
  period: string
): Promise<Map<string, number>> {
  const supabase = createClient();

  // Calculate previous period
  const [year, month] = period.split("-").map(Number);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevPeriod = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

  const { data } = await supabase
    .from("invoices")
    .select("unit_id, quota_amount")
    .eq("period", prevPeriod);

  const map = new Map<string, number>();
  for (const inv of data ?? []) {
    map.set(inv.unit_id, Number(inv.quota_amount));
  }
  return map;
}

/**
 * Generate invoices for all active units for a given period.
 * Uses the active budget and unit coefficients.
 * Skips units that already have an invoice for the period.
 */
export async function generateMonthlyInvoices(
  period: string,
  dueDate: string
): Promise<{ created: number; skipped: number; error: string | null }> {
  const supabase = createClient();
  const tenantId = await getTenantId();
  if (!tenantId) {
    return { created: 0, skipped: 0, error: "No hay sesion activa" };
  }

  // Find active budget for the year
  const year = Number(period.split("-")[0]);
  const { data: budget } = await supabase
    .from("budgets")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("year", year)
    .eq("status", "active")
    .single();

  if (!budget) {
    return { created: 0, skipped: 0, error: "No hay presupuesto vigente para el ano " + year };
  }

  // Get active units
  const { data: units } = await supabase
    .from("units")
    .select("id, coefficient")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (!units || units.length === 0) {
    return { created: 0, skipped: 0, error: "No hay unidades activas" };
  }

  // Check existing invoices
  const { data: existing } = await supabase
    .from("invoices")
    .select("unit_id")
    .eq("tenant_id", tenantId)
    .eq("period", period);

  const existingUnitIds = new Set((existing ?? []).map((e) => e.unit_id));

  // Check active extraordinary fees
  const { data: extraFeeUnits } = await supabase
    .from("extraordinary_fee_units")
    .select("unit_id, installment_amount, fee_id")
    .eq("tenant_id", tenantId)
    .neq("status", "paid");

  const extraByUnit = new Map<string, number>();
  for (const efu of extraFeeUnits ?? []) {
    const current = extraByUnit.get(efu.unit_id) ?? 0;
    extraByUnit.set(efu.unit_id, current + Number(efu.installment_amount));
  }

  const monthlyExpense = (budget as Budget).total / 12;

  // Build invoices
  const invoicesToInsert = [];
  let skipped = 0;

  for (const unit of units) {
    if (existingUnitIds.has(unit.id)) {
      skipped++;
      continue;
    }

    const quotaAmount = Math.round(monthlyExpense * unit.coefficient);
    const extraordinaryAmount = extraByUnit.get(unit.id) ?? 0;

    invoicesToInsert.push({
      tenant_id: tenantId,
      unit_id: unit.id,
      budget_id: budget.id,
      period,
      quota_amount: quotaAmount,
      extraordinary_amount: extraordinaryAmount,
      late_fee_amount: 0,
      status: "pending",
      issue_date: new Date().toISOString().split("T")[0],
      due_date: dueDate,
    });
  }

  if (invoicesToInsert.length === 0) {
    return { created: 0, skipped, error: null };
  }

  const { error: insertError } = await supabase
    .from("invoices")
    .insert(invoicesToInsert);

  if (insertError) {
    return { created: 0, skipped, error: insertError.message };
  }

  return { created: invoicesToInsert.length, skipped, error: null };
}
