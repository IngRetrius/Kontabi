import { createClient } from "@/lib/supabase/client";
import { createTransaction } from "@/lib/accounting/engine";
import { getSettings } from "@/lib/settings/tenant-settings";

// -- Types -------------------------------------------------------------------

export interface LateInterestRow {
  invoiceId: string;
  unitId: string;
  unitNumber: string;
  period: string;
  daysOverdue: number;
  outstanding: number;
  interestAmount: number;
}

export interface LateInterestConfig {
  rate: number;
  gracePeriodDays: number;
  compound: boolean;
}

export interface ApplyInterestResult {
  applied: number;
  total: number;
  error: string | null;
}

// -- Core --------------------------------------------------------------------

/**
 * Calculate late interest for all overdue invoices.
 * Uses the DB function calculate_late_interest() for consistent math,
 * then joins unit info for display.
 */
export async function calculateLateInterest(
  period?: string
): Promise<{ rows: LateInterestRow[]; config: LateInterestConfig; error: string | null }> {
  const supabase = createClient();

  // Call DB function
  const { data, error } = await supabase.rpc("calculate_late_interest", {
    p_period: period ?? null,
  });

  if (error) {
    return { rows: [], config: defaultConfig(), error: error.message };
  }

  // Get unit numbers
  const unitIds = [...new Set((data ?? []).map((r: { unit_id: string }) => r.unit_id))];
  const unitMap = new Map<string, string>();

  if (unitIds.length > 0) {
    const { data: units } = await supabase
      .from("units")
      .select("id, number")
      .in("id", unitIds);
    for (const u of units ?? []) {
      unitMap.set(u.id, u.number);
    }
  }

  const rows: LateInterestRow[] = (data ?? []).map(
    (r: { invoice_id: string; unit_id: string; period: string; days_overdue: number; outstanding: number; interest_amount: number }) => ({
      invoiceId: r.invoice_id,
      unitId: r.unit_id,
      unitNumber: unitMap.get(r.unit_id) ?? r.unit_id,
      period: r.period,
      daysOverdue: r.days_overdue,
      outstanding: Number(r.outstanding),
      interestAmount: Number(r.interest_amount),
    })
  );

  // Get config
  const config = await getConfig();

  return { rows, config, error: null };
}

/**
 * Apply calculated late interest to invoices:
 * 1. Updates invoice.late_fee_amount (triggers total recalculation)
 * 2. Creates accounting transaction for each invoice
 */
export async function applyLateInterest(
  rows: LateInterestRow[]
): Promise<ApplyInterestResult> {
  const supabase = createClient();
  let applied = 0;
  let totalInterest = 0;

  for (const row of rows) {
    if (row.interestAmount <= 0) continue;

    // Update invoice late_fee_amount
    const { error: updErr } = await supabase
      .from("invoices")
      .update({ late_fee_amount: row.interestAmount })
      .eq("id", row.invoiceId);

    if (updErr) {
      return { applied, total: totalInterest, error: `Error actualizando cobro ${row.period} unidad ${row.unitNumber}: ${updErr.message}` };
    }

    // Create accounting transaction: DB 1150 (CxC mora) / CR 4210 (Ingresos mora)
    const { error: txErr } = await createTransaction({
      type: "late_interest",
      amount: row.interestAmount,
      date: new Date().toISOString().split("T")[0],
      description: `Intereses mora Apto ${row.unitNumber} periodo ${row.period}`,
      unitId: row.unitId,
      metadata: {
        unit_label: row.unitNumber,
        period: row.period,
        months: String(Math.ceil(row.daysOverdue / 30)),
        balance: String(row.outstanding),
      },
    });

    if (txErr) {
      return { applied, total: totalInterest, error: `Error creando asiento para ${row.unitNumber}: ${txErr}` };
    }

    applied += 1;
    totalInterest += row.interestAmount;
  }

  return { applied, total: totalInterest, error: null };
}

/**
 * Mark overdue invoices by calling the DB function.
 */
export async function markOverdueInvoices(): Promise<{
  affected: number;
  error: string | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("mark_overdue_invoices");

  if (error) return { affected: 0, error: error.message };
  return { affected: data as number, error: null };
}

// -- Config ------------------------------------------------------------------

async function getConfig(): Promise<LateInterestConfig> {
  const settings = await getSettings([
    "late_fee_rate",
    "grace_period_days",
    "late_fee_type",
  ]);

  const rateRaw = Number(settings.late_fee_rate);
  return {
    rate: rateRaw > 1 ? rateRaw / 100 : rateRaw,
    gracePeriodDays: Number(settings.grace_period_days) || 5,
    compound: settings.late_fee_type === "compound",
  };
}

function defaultConfig(): LateInterestConfig {
  return { rate: 0.015, gracePeriodDays: 5, compound: false };
}
