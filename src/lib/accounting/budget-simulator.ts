import { createClient } from "@/lib/supabase/client";
import type { Budget, BudgetItem } from "@/types/database";

// -- Types -------------------------------------------------------------------

export interface SimulatorScenario {
  name: string;
  increments: Record<string, number>;
  uniformIncrement: number | null;
}

export interface SimulatorItemResult {
  itemId: string;
  itemName: string;
  category: string;
  currentMonthly: number;
  currentAnnual: number;
  newMonthly: number;
  newAnnual: number;
  incrementPct: number;
  differenceAnnual: number;
}

export interface SimulatorResult {
  scenarioName: string;
  baseBudgetYear: number;
  items: SimulatorItemResult[];
  currentTotal: number;
  newTotal: number;
  differenceTotal: number;
  incrementPctTotal: number;
  monthlyImpactPerCoefficient: number;
}

// -- Core logic --------------------------------------------------------------

/**
 * Simulate budget increments on an existing budget.
 * Supports uniform % increment or per-item increments.
 *
 * @param baseBudgetId - The budget to use as base
 * @param scenario - The scenario with increment percentages
 * @returns Simulation results with before/after comparison
 */
export async function simulateIncrements(
  baseBudgetId: string,
  scenario: SimulatorScenario
): Promise<{ result: SimulatorResult | null; error: string | null }> {
  const supabase = createClient();

  // Fetch budget
  const { data: budget, error: budgetError } = await supabase
    .from("budgets")
    .select("*")
    .eq("id", baseBudgetId)
    .single();

  if (budgetError || !budget) {
    return { result: null, error: "Presupuesto base no encontrado" };
  }

  // Fetch items
  const { data: items, error: itemsError } = await supabase
    .from("budget_items")
    .select("*")
    .eq("budget_id", baseBudgetId)
    .order("sort_order");

  if (itemsError) {
    return { result: null, error: itemsError.message };
  }

  const budgetItems = (items ?? []) as BudgetItem[];
  const typedBudget = budget as Budget;

  // Apply increments
  const resultItems: SimulatorItemResult[] = budgetItems.map((item) => {
    const incrementPct =
      scenario.increments[item.id] ??
      scenario.uniformIncrement ??
      0;

    const factor = 1 + incrementPct / 100;
    const newMonthly = Math.round(item.monthly_amount * factor);
    const newAnnual = newMonthly * 12;

    return {
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      currentMonthly: item.monthly_amount,
      currentAnnual: item.annual_amount,
      newMonthly,
      newAnnual,
      incrementPct,
      differenceAnnual: newAnnual - item.annual_amount,
    };
  });

  const currentTotal = typedBudget.total;
  const newTotal = resultItems.reduce((sum, r) => sum + r.newAnnual, 0);

  return {
    result: {
      scenarioName: scenario.name,
      baseBudgetYear: typedBudget.year,
      items: resultItems,
      currentTotal,
      newTotal,
      differenceTotal: newTotal - currentTotal,
      incrementPctTotal:
        currentTotal > 0
          ? Math.round(((newTotal - currentTotal) / currentTotal) * 10000) / 100
          : 0,
      monthlyImpactPerCoefficient: Math.round((newTotal - currentTotal) / 12),
    },
    error: null,
  };
}

/**
 * Create a new budget from simulation results.
 * Copies items with the new amounts to a new budget for the target year.
 */
export async function createBudgetFromSimulation(
  baseBudgetId: string,
  targetYear: number,
  name: string,
  scenario: SimulatorScenario
): Promise<{ budgetId: string | null; error: string | null }> {
  const supabase = createClient();

  // Get simulation
  const { result, error: simError } = await simulateIncrements(
    baseBudgetId,
    scenario
  );
  if (simError || !result) {
    return { budgetId: null, error: simError };
  }

  // Get tenant
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { budgetId: null, error: "No hay sesion activa" };

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("auth_id", user.id)
    .single();

  if (!userData) return { budgetId: null, error: "Tenant no encontrado" };

  // Fetch base items for account_id references
  const { data: baseItems } = await supabase
    .from("budget_items")
    .select("*")
    .eq("budget_id", baseBudgetId)
    .order("sort_order");

  const baseItemsMap = new Map(
    ((baseItems ?? []) as BudgetItem[]).map((i) => [i.id, i])
  );

  // Create budget
  const { data: newBudget, error: createError } = await supabase
    .from("budgets")
    .insert({
      tenant_id: userData.tenant_id,
      year: targetYear,
      name,
      status: "draft",
    })
    .select()
    .single();

  if (createError || !newBudget) {
    return { budgetId: null, error: createError?.message ?? "Error creando presupuesto" };
  }

  // Create items
  const newItems = result.items.map((item, index) => {
    const baseItem = baseItemsMap.get(item.itemId);
    return {
      tenant_id: userData.tenant_id,
      budget_id: newBudget.id,
      account_id: baseItem?.account_id ?? null,
      name: item.itemName,
      category: item.category,
      monthly_amount: item.newMonthly,
      annual_amount: item.newAnnual,
      sort_order: index,
    };
  });

  const { error: itemsError } = await supabase
    .from("budget_items")
    .insert(newItems);

  if (itemsError) {
    // Cleanup: delete the budget
    await supabase.from("budgets").delete().eq("id", newBudget.id);
    return { budgetId: null, error: itemsError.message };
  }

  return { budgetId: newBudget.id, error: null };
}
