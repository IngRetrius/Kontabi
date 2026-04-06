import { createClient } from "@/lib/supabase/client";
import type { BankStatementLine, MatchStatus } from "@/types/database";

// -- Types -------------------------------------------------------------------

export interface ReconciliationReportLine {
  date: string;
  description: string;
  amount: number;
  type: "debit" | "credit";
}

export interface ReconciliationReport {
  period: string;
  bankName: string;
  statementId: string;
  reconciledAt: string | null;

  bankBalance: number;
  bookBalance: number;

  // Items in bank but not in books
  inBankNotBooks: ReconciliationReportLine[];
  inBankNotBooksTotal: number;

  // Items in books but not in bank
  inBooksNotBank: ReconciliationReportLine[];
  inBooksNotBankTotal: number;

  // Reconciled balance (should match)
  adjustedBankBalance: number;
  adjustedBookBalance: number;

  totalMatched: number;
  totalExcluded: number;
  totalLines: number;
}

// -- Generate report ---------------------------------------------------------

export async function generateReconciliationReport(
  statementId: string
): Promise<{ report: ReconciliationReport | null; error: string | null }> {
  const supabase = createClient();

  // Fetch statement
  const { data: stmt, error: stmtErr } = await supabase
    .from("bank_statements")
    .select("*")
    .eq("id", statementId)
    .single();

  if (stmtErr || !stmt) {
    return { report: null, error: stmtErr?.message ?? "Extracto no encontrado" };
  }

  // Fetch all lines with their match status
  const { data: lines, error: linesErr } = await supabase
    .from("bank_statement_lines")
    .select("*")
    .eq("statement_id", statementId)
    .order("line_date");

  if (linesErr) {
    return { report: null, error: linesErr.message };
  }

  const allLines = (lines ?? []) as BankStatementLine[];

  // Calculate bank balance from statement
  const bankCredits = allLines
    .filter((l) => l.line_type === "credit")
    .reduce((s, l) => s + Number(l.amount), 0);
  const bankDebits = allLines
    .filter((l) => l.line_type === "debit")
    .reduce((s, l) => s + Number(l.amount), 0);
  const bankBalance = bankCredits - bankDebits;

  // Get matched transaction IDs
  const matchedTxIds = allLines
    .filter((l) => l.matched_transaction_id && (l.match_status === "matched" || l.match_status === "manual"))
    .map((l) => l.matched_transaction_id!);

  // Fetch book transactions for the period
  const [year, month] = stmt.period.split("-").map(Number);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];

  const { data: bookTxs } = await supabase
    .from("transactions")
    .select("id, date, description, amount, type")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date");

  const allBookTxs = bookTxs ?? [];

  // Book balance (net of all transactions in the period)
  const bookBalance = allBookTxs.reduce((s, tx) => s + Number(tx.amount), 0);

  // Items in bank but not in books (unmatched + excluded bank lines)
  const inBankNotBooks: ReconciliationReportLine[] = allLines
    .filter((l) => l.match_status === "pending" || l.match_status === "excluded")
    .map((l) => ({
      date: l.line_date,
      description: l.description,
      amount: Number(l.amount),
      type: l.line_type as "debit" | "credit",
    }));

  const inBankNotBooksTotal = inBankNotBooks.reduce(
    (s, l) => s + (l.type === "credit" ? l.amount : -l.amount),
    0
  );

  // Items in books but not in bank (transactions not matched to any line)
  const matchedTxIdSet = new Set(matchedTxIds);
  const inBooksNotBank: ReconciliationReportLine[] = allBookTxs
    .filter((tx) => !matchedTxIdSet.has(tx.id))
    .map((tx) => ({
      date: tx.date,
      description: tx.description,
      amount: Number(tx.amount),
      type: "credit" as const,
    }));

  const inBooksNotBankTotal = inBooksNotBank.reduce(
    (s, l) => s + l.amount,
    0
  );

  // Adjusted balances
  const adjustedBankBalance = bankBalance - inBankNotBooksTotal;
  const adjustedBookBalance = bookBalance - inBooksNotBankTotal;

  const totalMatched = allLines.filter(
    (l) => l.match_status === "matched" || l.match_status === "manual"
  ).length;
  const totalExcluded = allLines.filter((l) => l.match_status === "excluded").length;

  return {
    report: {
      period: stmt.period,
      bankName: stmt.bank_name,
      statementId,
      reconciledAt: stmt.reconciled_at,
      bankBalance,
      bookBalance,
      inBankNotBooks,
      inBankNotBooksTotal,
      inBooksNotBank,
      inBooksNotBankTotal,
      adjustedBankBalance,
      adjustedBookBalance,
      totalMatched,
      totalExcluded,
      totalLines: allLines.length,
    },
    error: null,
  };
}
