import { createClient } from "@/lib/supabase/client";
import type {
  Transaction,
  BankStatementLine,
  MatchCandidate,
  ConfidenceLevel,
} from "@/types/database";

// -- Configuration -----------------------------------------------------------

const DEFAULT_DATE_TOLERANCE = 3; // days
const DEFAULT_SCORE_THRESHOLD = 40; // minimum score to consider a match

const WEIGHT_AMOUNT = 50;
const WEIGHT_DATE = 30;
const WEIGHT_REFERENCE = 20;

// -- Scoring -----------------------------------------------------------------

function scoreAmountMatch(
  lineAmount: number,
  txAmount: number
): { score: number; exact: boolean } {
  if (lineAmount === txAmount) {
    return { score: WEIGHT_AMOUNT, exact: true };
  }
  // Allow small tolerance for rounding (0.5%)
  const diff = Math.abs(lineAmount - txAmount);
  const pct = diff / Math.max(lineAmount, txAmount);
  if (pct <= 0.005) {
    return { score: WEIGHT_AMOUNT * 0.9, exact: false };
  }
  return { score: 0, exact: false };
}

function scoreDateMatch(
  lineDate: string,
  txDate: string,
  tolerance: number
): { score: number; distance: number } {
  const ld = new Date(lineDate).getTime();
  const td = new Date(txDate).getTime();
  const daysDiff = Math.abs(ld - td) / (1000 * 60 * 60 * 24);

  if (daysDiff === 0) return { score: WEIGHT_DATE, distance: 0 };
  if (daysDiff <= tolerance) {
    const ratio = 1 - daysDiff / (tolerance + 1);
    return { score: WEIGHT_DATE * ratio, distance: daysDiff };
  }
  return { score: 0, distance: daysDiff };
}

function scoreReferenceMatch(
  lineDesc: string,
  lineRef: string,
  txDesc: string
): number {
  if (!lineDesc && !lineRef) return 0;
  if (!txDesc) return 0;

  const lineText = `${lineDesc} ${lineRef}`.toLowerCase().trim();
  const txText = txDesc.toLowerCase().trim();

  // Exact reference match
  if (lineRef && txText.includes(lineRef.toLowerCase())) {
    return WEIGHT_REFERENCE;
  }

  // Token overlap (Jaccard-like)
  const lineTokens = new Set(lineText.split(/\s+/).filter((t) => t.length > 2));
  const txTokens = new Set(txText.split(/\s+/).filter((t) => t.length > 2));

  if (lineTokens.size === 0 || txTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of lineTokens) {
    if (txTokens.has(token)) overlap++;
  }

  const jaccard = overlap / (lineTokens.size + txTokens.size - overlap);
  return WEIGHT_REFERENCE * Math.min(jaccard * 2, 1);
}

function getConfidence(score: number): ConfidenceLevel {
  if (score >= 90) return "high";
  if (score >= 60) return "medium";
  return "low";
}

// -- Public API --------------------------------------------------------------

export interface MatchEngineOptions {
  dateTolerance?: number;
  scoreThreshold?: number;
}

export interface MatchResult {
  lineId: string;
  candidates: MatchCandidate[];
  bestMatch: MatchCandidate | null;
}

export function findMatchCandidates(
  line: Pick<BankStatementLine, "id" | "line_date" | "description" | "reference" | "amount">,
  transactions: Pick<Transaction, "id" | "date" | "description" | "amount">[],
  options: MatchEngineOptions = {}
): MatchCandidate[] {
  const tolerance = options.dateTolerance ?? DEFAULT_DATE_TOLERANCE;
  const threshold = options.scoreThreshold ?? DEFAULT_SCORE_THRESHOLD;

  const candidates: MatchCandidate[] = [];

  for (const tx of transactions) {
    const amountResult = scoreAmountMatch(line.amount, tx.amount);
    // Skip if amount does not match at all
    if (amountResult.score === 0) continue;

    const dateResult = scoreDateMatch(line.line_date, tx.date, tolerance);
    const refScore = scoreReferenceMatch(
      line.description,
      line.reference ?? "",
      tx.description
    );

    const totalScore = amountResult.score + dateResult.score + refScore;

    if (totalScore >= threshold) {
      candidates.push({
        transactionId: tx.id,
        score: Math.round(totalScore * 100) / 100,
        confidence: getConfidence(totalScore),
        amountMatch: amountResult.exact,
        dateDistance: dateResult.distance,
        referenceScore: Math.round(refScore * 100) / 100,
      });
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

export async function runMatchingEngine(
  statementId: string,
  options: MatchEngineOptions = {}
): Promise<{ results: MatchResult[]; error: string | null }> {
  const supabase = createClient();

  // Fetch statement lines
  const { data: lines, error: linesErr } = await supabase
    .from("bank_statement_lines")
    .select("id, line_date, description, reference, amount, line_type, match_status")
    .eq("statement_id", statementId)
    .eq("match_status", "pending")
    .order("line_date");

  if (linesErr) {
    return { results: [], error: linesErr.message };
  }

  if (!lines || lines.length === 0) {
    return { results: [], error: null };
  }

  // Get the statement's period to scope transaction search
  const { data: stmt } = await supabase
    .from("bank_statements")
    .select("period, tenant_id")
    .eq("id", statementId)
    .single();

  if (!stmt) {
    return { results: [], error: "Extracto no encontrado" };
  }

  // Fetch transactions for the period (+/- 1 month for tolerance)
  const [year, month] = stmt.period.split("-").map(Number);
  const startDate = new Date(year, month - 2, 1).toISOString().split("T")[0];
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];

  const { data: transactions, error: txErr } = await supabase
    .from("transactions")
    .select("id, date, description, amount, type")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date");

  if (txErr) {
    return { results: [], error: txErr.message };
  }

  if (!transactions || transactions.length === 0) {
    return {
      results: (lines as Pick<BankStatementLine, "id" | "line_date" | "description" | "reference" | "amount">[]).map((l) => ({
        lineId: l.id,
        candidates: [],
        bestMatch: null,
      })),
      error: null,
    };
  }

  // Index transactions by amount for O(1) lookup
  const txByAmount = new Map<number, typeof transactions>();
  for (const tx of transactions) {
    const key = tx.amount;
    if (!txByAmount.has(key)) txByAmount.set(key, []);
    txByAmount.get(key)!.push(tx);
  }

  // Track assigned transactions to prevent duplicates
  const assignedTxIds = new Set<string>();
  const results: MatchResult[] = [];

  // Sort lines by amount descending (prioritize larger amounts for matching)
  const sortedLines = [...(lines as Pick<BankStatementLine, "id" | "line_date" | "description" | "reference" | "amount">[])].sort(
    (a, b) => b.amount - a.amount
  );

  for (const line of sortedLines) {
    // Get candidate transactions (exact amount match)
    const exactMatches = txByAmount.get(line.amount) ?? [];
    // Also check amounts within 0.5% tolerance
    const nearMatches: typeof transactions = [];
    for (const [amt, txs] of txByAmount) {
      if (amt !== line.amount) {
        const diff = Math.abs(amt - line.amount);
        if (diff / Math.max(amt, line.amount) <= 0.005) {
          nearMatches.push(...txs);
        }
      }
    }

    const candidateTxs = [...exactMatches, ...nearMatches].filter(
      (tx) => !assignedTxIds.has(tx.id)
    );

    const candidates = findMatchCandidates(line, candidateTxs, options);
    const bestMatch = candidates[0] ?? null;

    if (bestMatch) {
      assignedTxIds.add(bestMatch.transactionId);
    }

    results.push({ lineId: line.id, candidates, bestMatch });
  }

  return { results, error: null };
}
