import { createClient } from "@/lib/supabase/client";
import {
  calculateExecution,
  type BudgetExecution,
} from "@/lib/accounting/budget-execution";

export interface BudgetExecutionReportData {
  execution: BudgetExecution;
  budgetName: string;
}

export async function generateBudgetExecutionReport(
  upToMonth?: number
): Promise<{ data: BudgetExecutionReportData | null; error: string | null }> {
  const supabase = createClient();

  // Find the active budget
  const { data: budget } = await supabase
    .from("budgets")
    .select("id, name")
    .eq("status", "active")
    .limit(1)
    .single();

  if (!budget) {
    return { data: null, error: "No hay presupuesto activo" };
  }

  const { execution, error } = await calculateExecution(
    budget.id,
    upToMonth
  );

  if (error || !execution) {
    return { data: null, error: error ?? "Error calculando ejecucion" };
  }

  return {
    data: {
      execution,
      budgetName: budget.name ?? `Presupuesto ${execution.budgetYear}`,
    },
    error: null,
  };
}
