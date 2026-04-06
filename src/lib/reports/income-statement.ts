import { createClient } from "@/lib/supabase/client";

export interface IncomeStatementLine {
  accountCode: string;
  accountName: string;
  total: number;
}

export interface IncomeStatementData {
  period: string;
  income: IncomeStatementLine[];
  expenses: IncomeStatementLine[];
  totalIncome: number;
  totalExpenses: number;
  netResult: number;
}

export async function generateIncomeStatement(
  period: string
): Promise<{ data: IncomeStatementData | null; error: string | null }> {
  const supabase = createClient();
  const [year, month] = period.split("-").map(Number);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];

  // Fetch all confirmed journal entry lines with account info for the period
  const { data: lines, error } = await supabase
    .from("journal_entry_lines")
    .select(`
      account_id,
      debit,
      credit,
      account:accounts!inner(code, name, type),
      journal_entry:journal_entries!inner(date, status)
    `)
    .eq("journal_entry.status", "confirmed")
    .gte("journal_entry.date", startDate)
    .lte("journal_entry.date", endDate);

  if (error) return { data: null, error: error.message };

  // Group by account
  const accountMap = new Map<
    string,
    { code: string; name: string; type: string; total: number }
  >();

  for (const line of lines ?? []) {
    const acct = line.account as unknown as {
      code: string;
      name: string;
      type: string;
    };
    const key = acct.code;
    const existing = accountMap.get(key) ?? {
      code: acct.code,
      name: acct.name,
      type: acct.type,
      total: 0,
    };

    // Income accounts (4xxx) increase with credits
    // Expense accounts (5xxx) increase with debits
    if (acct.type === "income") {
      existing.total += Number(line.credit) - Number(line.debit);
    } else if (acct.type === "expense") {
      existing.total += Number(line.debit) - Number(line.credit);
    }

    accountMap.set(key, existing);
  }

  const income: IncomeStatementLine[] = [];
  const expenses: IncomeStatementLine[] = [];

  for (const [, acct] of accountMap) {
    if (acct.total === 0) continue;
    const line = {
      accountCode: acct.code,
      accountName: acct.name,
      total: Math.abs(acct.total),
    };
    if (acct.type === "income") income.push(line);
    else if (acct.type === "expense") expenses.push(line);
  }

  income.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
  expenses.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  const totalIncome = income.reduce((s, l) => s + l.total, 0);
  const totalExpenses = expenses.reduce((s, l) => s + l.total, 0);

  return {
    data: {
      period,
      income,
      expenses,
      totalIncome,
      totalExpenses,
      netResult: totalIncome - totalExpenses,
    },
    error: null,
  };
}
