import { createClient } from "@/lib/supabase/client";

export interface TrialBalanceLine {
  accountCode: string;
  accountName: string;
  totalDebit: number;
  totalCredit: number;
  debitBalance: number;
  creditBalance: number;
}

export interface TrialBalanceData {
  period: string;
  lines: TrialBalanceLine[];
  totalDebit: number;
  totalCredit: number;
  totalDebitBalance: number;
  totalCreditBalance: number;
  isBalanced: boolean;
}

export async function generateTrialBalance(
  period: string
): Promise<{ data: TrialBalanceData | null; error: string | null }> {
  const supabase = createClient();
  const [year, month] = period.split("-").map(Number);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];

  const { data: lines, error } = await supabase
    .from("journal_entry_lines")
    .select(`
      debit,
      credit,
      account:accounts!inner(code, name),
      journal_entry:journal_entries!inner(date, status)
    `)
    .eq("journal_entry.status", "confirmed")
    .gte("journal_entry.date", startDate)
    .lte("journal_entry.date", endDate);

  if (error) return { data: null, error: error.message };

  // Aggregate by account
  const map = new Map<string, { name: string; debit: number; credit: number }>();

  for (const line of lines ?? []) {
    const acct = line.account as unknown as { code: string; name: string };
    const existing = map.get(acct.code) ?? { name: acct.name, debit: 0, credit: 0 };
    existing.debit += Number(line.debit);
    existing.credit += Number(line.credit);
    map.set(acct.code, existing);
  }

  const result: TrialBalanceLine[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  let totalDebitBalance = 0;
  let totalCreditBalance = 0;

  const sorted = Array.from(map.entries()).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  for (const [code, acct] of sorted) {
    const diff = acct.debit - acct.credit;
    const debitBalance = diff > 0 ? diff : 0;
    const creditBalance = diff < 0 ? Math.abs(diff) : 0;

    result.push({
      accountCode: code,
      accountName: acct.name,
      totalDebit: acct.debit,
      totalCredit: acct.credit,
      debitBalance,
      creditBalance,
    });

    totalDebit += acct.debit;
    totalCredit += acct.credit;
    totalDebitBalance += debitBalance;
    totalCreditBalance += creditBalance;
  }

  return {
    data: {
      period,
      lines: result,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      totalDebitBalance: Math.round(totalDebitBalance * 100) / 100,
      totalCreditBalance: Math.round(totalCreditBalance * 100) / 100,
      isBalanced:
        Math.abs(totalDebit - totalCredit) < 0.01 &&
        Math.abs(totalDebitBalance - totalCreditBalance) < 0.01,
    },
    error: null,
  };
}
