import { createClient } from "@/lib/supabase/client";
import type { BudgetItem } from "@/types/database";

// -- Types -------------------------------------------------------------------

export type ExecutionSemaphore = "green" | "yellow" | "red";

export interface BudgetExecutionItem {
  itemId: string;
  itemName: string;
  category: string;
  accountId: string | null;
  accountCode: string | null;
  budgetedMonthly: number;
  budgetedAccumulated: number;
  executedAccumulated: number;
  variance: number;
  executionPct: number;
  semaphore: ExecutionSemaphore;
}

export interface BudgetExecution {
  budgetId: string;
  budgetYear: number;
  period: string;
  monthsElapsed: number;
  items: BudgetExecutionItem[];
  totalBudgeted: number;
  totalExecuted: number;
  totalVariance: number;
  totalExecutionPct: number;
  overBudgetAlerts: BudgetExecutionItem[];
}

// -- Helpers -----------------------------------------------------------------

function getSemaphore(executionPct: number): ExecutionSemaphore {
  if (executionPct > 115) return "red";
  if (executionPct > 100) return "yellow";
  return "green";
}

// -- Core logic --------------------------------------------------------------

/**
 * Calculate budget execution: compare budgeted amounts vs actual expenses.
 *
 * Actual expenses are derived from journal_entry_lines for the accounts
 * linked to each budget item. This is the bridge between P2 (accounting)
 * and P4 (budgets).
 *
 * @param budgetId - The budget to analyze
 * @param upToMonth - Month number (1-12) to calculate accumulated execution
 */
export async function calculateExecution(
  budgetId: string,
  upToMonth?: number
): Promise<{ execution: BudgetExecution | null; error: string | null }> {
  const supabase = createClient();

  // Fetch budget
  const { data: budget, error: budgetError } = await supabase
    .from("budgets")
    .select("*")
    .eq("id", budgetId)
    .single();

  if (budgetError || !budget) {
    return { execution: null, error: "Presupuesto no encontrado" };
  }

  // Determine period
  const currentMonth = upToMonth ?? new Date().getMonth() + 1;
  const period = `${budget.year}-${String(currentMonth).padStart(2, "0")}`;

  // Fetch items with account info
  const { data: items } = await supabase
    .from("budget_items")
    .select(`
      *,
      account:accounts(id, code, name)
    `)
    .eq("budget_id", budgetId)
    .order("sort_order");

  const budgetItems = (items ?? []) as (BudgetItem & {
    account: { id: string; code: string; name: string } | null;
  })[];

  // Fetch actual expenses from journal entries for the budget year
  const startDate = `${budget.year}-01-01`;
  const endDate = `${budget.year}-${String(currentMonth).padStart(2, "0")}-${new Date(budget.year, currentMonth, 0).getDate()}`;

  // Get all confirmed journal entry lines for the relevant accounts
  const accountIds = budgetItems
    .map((item) => item.account_id)
    .filter((id): id is string => id !== null);

  let executionByAccount = new Map<string, number>();

  if (accountIds.length > 0) {
    const { data: lines } = await supabase
      .from("journal_entry_lines")
      .select(`
        account_id,
        debit,
        credit,
        journal_entry:journal_entries!inner(date, status)
      `)
      .in("account_id", accountIds)
      .eq("journal_entry.status", "confirmed")
      .gte("journal_entry.date", startDate)
      .lte("journal_entry.date", endDate);

    for (const line of lines ?? []) {
      const current = executionByAccount.get(line.account_id) ?? 0;
      // Expense accounts increase with debits
      executionByAccount.set(
        line.account_id,
        current + Number(line.debit) - Number(line.credit)
      );
    }
  }

  // Build execution items
  const executionItems: BudgetExecutionItem[] = budgetItems.map((item) => {
    const budgetedAccumulated = item.monthly_amount * currentMonth;
    const executedAccumulated = item.account_id
      ? executionByAccount.get(item.account_id) ?? 0
      : 0;
    const variance = executedAccumulated - budgetedAccumulated;
    const executionPct =
      budgetedAccumulated > 0
        ? Math.round((executedAccumulated / budgetedAccumulated) * 10000) / 100
        : 0;

    return {
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      accountId: item.account_id,
      accountCode: item.account?.code ?? null,
      budgetedMonthly: item.monthly_amount,
      budgetedAccumulated,
      executedAccumulated: Math.abs(executedAccumulated),
      variance,
      executionPct,
      semaphore: getSemaphore(executionPct),
    };
  });

  const totalBudgeted = executionItems.reduce(
    (sum, i) => sum + i.budgetedAccumulated,
    0
  );
  const totalExecuted = executionItems.reduce(
    (sum, i) => sum + i.executedAccumulated,
    0
  );
  const totalVariance = totalExecuted - totalBudgeted;
  const totalExecutionPct =
    totalBudgeted > 0
      ? Math.round((totalExecuted / totalBudgeted) * 10000) / 100
      : 0;

  return {
    execution: {
      budgetId,
      budgetYear: budget.year,
      period,
      monthsElapsed: currentMonth,
      items: executionItems,
      totalBudgeted,
      totalExecuted,
      totalVariance,
      totalExecutionPct,
      overBudgetAlerts: executionItems.filter((i) => i.executionPct > 115),
    },
    error: null,
  };
}
