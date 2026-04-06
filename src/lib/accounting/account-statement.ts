import { createClient } from "@/lib/supabase/client";
import type { AgingBucket, AgingEntry } from "@/types/database";

// -- Types -------------------------------------------------------------------

export interface StatementLine {
  date: string;
  period: string;
  concept: string;
  charge: number;
  payment: number;
  balance: number;
}

export interface UnitStatementResult {
  unitId: string;
  unitNumber: string;
  tower: string | null;
  ownerName: string | null;
  coefficient: number;
  lines: StatementLine[];
  totalCharged: number;
  totalPaid: number;
  currentBalance: number;
  aging: AgingEntry[];
  error: string | null;
}

// -- Aging buckets -----------------------------------------------------------

const AGING_BUCKETS: {
  bucket: AgingBucket;
  label: string;
  minDays: number;
  maxDays: number;
  provisionPct: number;
}[] = [
  { bucket: "current", label: "Corriente (0-30)", minDays: 0, maxDays: 30, provisionPct: 0 },
  { bucket: "30", label: "31-60 dias", minDays: 31, maxDays: 60, provisionPct: 10 },
  { bucket: "60", label: "61-90 dias", minDays: 61, maxDays: 90, provisionPct: 30 },
  { bucket: "90", label: "91-180 dias", minDays: 91, maxDays: 180, provisionPct: 60 },
  { bucket: "180", label: "181-360 dias", minDays: 181, maxDays: 360, provisionPct: 80 },
  { bucket: "over_180", label: "> 360 dias", minDays: 361, maxDays: Infinity, provisionPct: 100 },
];

export { AGING_BUCKETS };

// -- Core --------------------------------------------------------------------

/**
 * Build a full account statement for a single unit.
 * Includes all invoices + payments as chronological lines,
 * running balance, and aging classification.
 */
export async function getUnitStatement(
  unitId: string
): Promise<UnitStatementResult> {
  const supabase = createClient();

  // 1. Get unit info
  const { data: unit, error: unitErr } = await supabase
    .from("units")
    .select("id, number, coefficient, building:buildings(name)")
    .eq("id", unitId)
    .single();

  if (unitErr || !unit) {
    return emptyResult(unitId, `Unidad no encontrada: ${unitErr?.message}`);
  }

  // Get owner name if available
  let ownerName: string | null = null;
  const { data: owner } = await supabase
    .from("owners")
    .select("full_name")
    .eq("unit_id", unitId)
    .eq("is_current", true)
    .single();
  if (owner) ownerName = owner.full_name;

  // 2. Get all invoices for this unit
  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("unit_id", unitId)
    .order("period", { ascending: true });

  // 3. Get all payment applications for this unit's invoices
  const invoiceIds = (invoices ?? []).map((i) => i.id);
  let applications: {
    invoice_id: string;
    amount_applied: number;
    created_at: string;
    payment:
      | { payment_date: string; reference: string | null }
      | Array<{ payment_date: string; reference: string | null }>;
  }[] = [];

  if (invoiceIds.length > 0) {
    const { data: apps } = await supabase
      .from("payment_applications")
      .select("invoice_id, amount_applied, created_at, payment:payments!inner(payment_date, reference)")
      .in("invoice_id", invoiceIds);
    applications = (apps ?? []) as {
      invoice_id: string;
      amount_applied: number;
      created_at: string;
      payment:
        | { payment_date: string; reference: string | null }
        | Array<{ payment_date: string; reference: string | null }>;
    }[];
  }

  // 4. Build statement lines
  const lines: StatementLine[] = [];
  let runningBalance = 0;
  let totalCharged = 0;
  let totalPaid = 0;

  for (const inv of invoices ?? []) {
    // Charge line
    runningBalance += inv.total;
    totalCharged += inv.total;
    lines.push({
      date: inv.issue_date,
      period: inv.period,
      concept: `Cobro ${inv.period}${inv.extraordinary_amount > 0 ? " (incl. extraordinaria)" : ""}${inv.late_fee_amount > 0 ? " (incl. mora)" : ""}`,
      charge: inv.total,
      payment: 0,
      balance: runningBalance,
    });

    // Payment lines for this invoice
    const invApps = applications.filter((a) => a.invoice_id === inv.id);
    for (const app of invApps) {
      const paymentInfo = Array.isArray(app.payment)
        ? app.payment[0]
        : app.payment;
      if (!paymentInfo) continue;
      runningBalance -= app.amount_applied;
      totalPaid += app.amount_applied;
      lines.push({
        date: paymentInfo.payment_date,
        period: inv.period,
        concept: `Pago${paymentInfo.reference ? ` ref: ${paymentInfo.reference}` : ""}`,
        charge: 0,
        payment: app.amount_applied,
        balance: runningBalance,
      });
    }
  }

  // 5. Calculate aging
  const today = new Date();
  const aging = calculateAging(invoices ?? [], today);

  return {
    unitId: unit.id,
    unitNumber: unit.number,
    tower:
      (Array.isArray(unit.building)
        ? unit.building[0]
        : (unit.building as { name: string } | null)
      )?.name ?? null,
    ownerName,
    coefficient: unit.coefficient,
    lines,
    totalCharged,
    totalPaid,
    currentBalance: runningBalance,
    aging,
    error: null,
  };
}

/**
 * Get aging summary across all units in the tenant.
 */
export async function getGlobalAging(): Promise<{
  aging: AgingEntry[];
  byUnit: { unitId: string; unitNumber: string; balance: number; bucket: AgingBucket }[];
  error: string | null;
}> {
  const supabase = createClient();

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, unit_id, period, total, paid_amount, due_date, status, unit:units!inner(number)")
    .in("status", ["pending", "partial", "overdue"]);

  if (error) return { aging: [], byUnit: [], error: error.message };

  const today = new Date();
  const aging = calculateAging(invoices ?? [], today);

  // Per-unit breakdown
  const unitMap = new Map<string, { unitNumber: string; balance: number; maxDays: number }>();
  for (const inv of invoices ?? []) {
    const outstanding = inv.total - inv.paid_amount;
    if (outstanding <= 0) continue;
    const daysOverdue = Math.max(0, Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / 86400000));
    const unitInfoRaw = inv.unit as { number: string } | Array<{ number: string }> | null;
    const unitInfo = Array.isArray(unitInfoRaw) ? unitInfoRaw[0] : unitInfoRaw;
    if (!unitInfo) continue;
    const existing = unitMap.get(inv.unit_id) ?? { unitNumber: unitInfo.number, balance: 0, maxDays: 0 };
    existing.balance += outstanding;
    existing.maxDays = Math.max(existing.maxDays, daysOverdue);
    unitMap.set(inv.unit_id, existing);
  }

  const byUnit = Array.from(unitMap.entries()).map(([unitId, info]) => ({
    unitId,
    unitNumber: info.unitNumber,
    balance: info.balance,
    bucket: getBucket(info.maxDays),
  }));

  byUnit.sort((a, b) => b.balance - a.balance);

  return { aging, byUnit, error: null };
}

// -- Helpers -----------------------------------------------------------------

function calculateAging(
  invoices: { total: number; paid_amount: number; due_date: string; status: string }[],
  today: Date
): AgingEntry[] {
  const buckets = AGING_BUCKETS.map((b) => ({
    ...b,
    amount: 0,
    count: 0,
    provision_amount: 0,
  }));

  for (const inv of invoices) {
    if (inv.status === "paid") continue;
    const outstanding = inv.total - inv.paid_amount;
    if (outstanding <= 0) continue;

    const daysOverdue = Math.max(
      0,
      Math.floor((today.getTime() - new Date(inv.due_date).getTime()) / 86400000)
    );

    for (const b of buckets) {
      if (daysOverdue >= b.minDays && daysOverdue <= b.maxDays) {
        b.amount += outstanding;
        b.count += 1;
        b.provision_amount += outstanding * (b.provisionPct / 100);
        break;
      }
    }
  }

  return buckets.map((b) => ({
    bucket: b.bucket,
    label: b.label,
    amount: Math.round(b.amount),
    count: b.count,
    provision_pct: b.provisionPct,
    provision_amount: Math.round(b.provision_amount),
  }));
}

function getBucket(daysOverdue: number): AgingBucket {
  for (const b of AGING_BUCKETS) {
    if (daysOverdue >= b.minDays && daysOverdue <= b.maxDays) return b.bucket;
  }
  return "over_180";
}

function emptyResult(unitId: string, error: string): UnitStatementResult {
  return {
    unitId,
    unitNumber: "",
    tower: null,
    ownerName: null,
    coefficient: 0,
    lines: [],
    totalCharged: 0,
    totalPaid: 0,
    currentBalance: 0,
    aging: [],
    error,
  };
}
