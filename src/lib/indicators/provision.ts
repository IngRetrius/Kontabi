import { createClient } from "@/lib/supabase/client";
import { createTransaction } from "@/lib/accounting/engine";
import { getGlobalAging, AGING_BUCKETS } from "@/lib/accounting/account-statement";
import type { AgingEntry } from "@/types/database";

// -- Types -------------------------------------------------------------------

export interface ProvisionResult {
  aging: AgingEntry[];
  totalOutstanding: number;
  totalProvision: number;
  provisionPct: number;
  previousProvision: number | null;
  error: string | null;
}

export interface ApplyProvisionResult {
  amount: number;
  error: string | null;
}

// -- Core --------------------------------------------------------------------

/**
 * Calculate portfolio provision based on aging buckets.
 * Each aging bracket has a provision percentage per Colombian standards.
 */
export async function calculateProvision(): Promise<ProvisionResult> {
  const { aging, error } = await getGlobalAging();

  if (error) {
    return {
      aging: [],
      totalOutstanding: 0,
      totalProvision: 0,
      provisionPct: 0,
      previousProvision: null,
      error,
    };
  }

  const totalOutstanding = aging.reduce((s, a) => s + a.amount, 0);
  const totalProvision = aging.reduce((s, a) => s + a.provision_amount, 0);
  const provisionPct =
    totalOutstanding > 0 ? Math.round((totalProvision / totalOutstanding) * 1000) / 10 : 0;

  // Get previous provision (last journal entry for account 5220)
  const previousProvision = await getPreviousProvision();

  return {
    aging,
    totalOutstanding,
    totalProvision,
    provisionPct,
    previousProvision,
    error: null,
  };
}

/**
 * Apply provision by creating an accounting entry:
 * DB 5220 (Provision de cartera - gasto)
 * CR 1130 (CxC cuotas - reduces receivables)
 */
export async function applyProvision(
  amount: number
): Promise<ApplyProvisionResult> {
  if (amount <= 0) {
    return { amount: 0, error: "El monto de provision debe ser positivo" };
  }

  const { error } = await createTransaction({
    type: "adjustment",
    amount,
    date: new Date().toISOString().split("T")[0],
    description: "Provision de cartera por antiguedad",
    debitAccountCode: "5220",  // Provision cartera (gasto)
    creditAccountCode: "1130", // CxC cuotas (reduce activo)
    metadata: {
      concept: "provision_cartera",
    },
  });

  if (error) return { amount: 0, error };
  return { amount, error: null };
}

/**
 * Get the suggested action for each aging bucket.
 */
export function getSuggestedActions(): {
  bucket: string;
  label: string;
  provisionPct: number;
  action: string;
}[] {
  return AGING_BUCKETS.map((b) => ({
    bucket: b.bucket,
    label: b.label,
    provisionPct: b.provisionPct,
    action: getAction(b.bucket),
  }));
}

// -- Helpers -----------------------------------------------------------------

function getAction(bucket: string): string {
  switch (bucket) {
    case "current":
      return "Recordatorio amigable";
    case "30":
      return "Notificacion formal por escrito";
    case "60":
      return "Carta de cobro pre-juridico";
    case "90":
      return "Inicio de cobro juridico";
    case "180":
      return "Proceso ejecutivo";
    case "over_180":
      return "Proceso ejecutivo / castigo de cartera";
    default:
      return "Revisar";
  }
}

async function getPreviousProvision(): Promise<number | null> {
  const supabase = createClient();

  const { data } = await supabase
    .from("journal_entry_lines")
    .select("debit, journal_entry:journal_entries!inner(status, date)")
    .eq("journal_entry.status", "confirmed")
    .eq("account_id", await getAccountId("5220"))
    .order("journal_entry.date", { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return null;
  return Number(data[0].debit);
}

async function getAccountId(code: string): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase
    .from("accounts")
    .select("id")
    .eq("code", code)
    .eq("is_active", true)
    .single();
  return data?.id ?? "";
}
