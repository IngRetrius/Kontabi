import { createClient } from "@/lib/supabase/client";
import { createTransaction } from "@/lib/accounting/engine";
import type { PaymentMethod } from "@/types/database";

// -- Types -------------------------------------------------------------------

export interface RegisterPaymentInput {
  unitId: string;
  invoiceIds: string[];
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  reference?: string;
  receiptUrl?: string;
  notes?: string;
}

export interface RegisterPaymentResult {
  paymentId: string | null;
  appliedInvoices: { invoiceId: string; amountApplied: number }[];
  surplus: number;
  error: string | null;
}

// -- Helpers -----------------------------------------------------------------

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  transfer: "transferencia",
  deposit: "consignacion",
  cash: "efectivo",
  other: "otro medio",
};

async function getTenantId(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("auth_id", user.id)
    .single();

  return data?.tenant_id ?? null;
}

// -- Core --------------------------------------------------------------------

/**
 * Registers a payment for a unit and applies it to selected invoices.
 *
 * Flow:
 * 1. Validate inputs
 * 2. Fetch selected invoices (sorted by period ASC — oldest first)
 * 3. Apply payment to invoices sequentially (update paid_amount)
 * 4. Create accounting transaction (DB Bancos / CR CxC cuotas)
 * 5. Create payment record with applications
 */
export async function registerPayment(
  input: RegisterPaymentInput
): Promise<RegisterPaymentResult> {
  const supabase = createClient();

  // 0. Resolve tenant
  const tenantId = await getTenantId();
  if (!tenantId) {
    return { paymentId: null, appliedInvoices: [], surplus: 0, error: "No hay sesion activa o no se encontro el tenant" };
  }

  // 1. Validations
  if (input.amount <= 0) {
    return { paymentId: null, appliedInvoices: [], surplus: 0, error: "El monto debe ser positivo" };
  }
  if (input.invoiceIds.length === 0) {
    return { paymentId: null, appliedInvoices: [], surplus: 0, error: "Debe seleccionar al menos un cobro" };
  }
  if (new Date(input.paymentDate) > new Date()) {
    return { paymentId: null, appliedInvoices: [], surplus: 0, error: "La fecha de pago no puede ser futura" };
  }

  // Check duplicate reference
  if (input.reference) {
    const { data: dup } = await supabase
      .from("payments")
      .select("id")
      .eq("reference", input.reference)
      .limit(1);
    if (dup && dup.length > 0) {
      return { paymentId: null, appliedInvoices: [], surplus: 0, error: `Ya existe un pago con referencia "${input.reference}"` };
    }
  }

  // 2. Fetch invoices sorted by period (oldest first)
  const { data: invoices, error: fetchErr } = await supabase
    .from("invoices")
    .select("*")
    .in("id", input.invoiceIds)
    .order("period", { ascending: true });

  if (fetchErr || !invoices) {
    return { paymentId: null, appliedInvoices: [], surplus: 0, error: `Error cargando cobros: ${fetchErr?.message}` };
  }

  // 3. Apply payment to invoices
  let remaining = input.amount;
  const applications: { invoiceId: string; amountApplied: number }[] = [];

  for (const inv of invoices) {
    if (remaining <= 0) break;
    const outstanding = inv.total - inv.paid_amount;
    if (outstanding <= 0) continue;

    const toApply = Math.min(remaining, outstanding);
    const newPaid = inv.paid_amount + toApply;

    const { error: updErr } = await supabase
      .from("invoices")
      .update({ paid_amount: newPaid })
      .eq("id", inv.id);

    if (updErr) {
      return { paymentId: null, appliedInvoices: applications, surplus: remaining, error: `Error actualizando cobro ${inv.period}: ${updErr.message}` };
    }

    applications.push({ invoiceId: inv.id, amountApplied: toApply });
    remaining -= toApply;
  }

  // 4. Fetch unit info for narrative
  const { data: unit } = await supabase
    .from("units")
    .select("number")
    .eq("id", input.unitId)
    .single();

  const unitLabel = unit?.number ?? input.unitId;
  const periods = invoices.map((i) => i.period).join(", ");

  // 5. Create accounting transaction
  const { transaction, error: txErr } = await createTransaction({
    type: "quota_payment",
    amount: input.amount,
    date: input.paymentDate,
    description: `Pago cuota Apto ${unitLabel} - ${periods}`,
    unitId: input.unitId,
    metadata: {
      unit_label: unitLabel,
      period: periods,
      method: PAYMENT_METHOD_LABELS[input.paymentMethod],
      reference: input.reference ?? null,
    },
  });

  if (txErr) {
    return { paymentId: null, appliedInvoices: applications, surplus: remaining, error: `Pago aplicado pero error en asiento: ${txErr}` };
  }

  // 6. Create payment record
  const { data: payment, error: payErr } = await supabase
    .from("payments")
    .insert({
      tenant_id: tenantId,
      unit_id: input.unitId,
      transaction_id: transaction.id,
      amount: input.amount,
      payment_date: input.paymentDate,
      payment_method: input.paymentMethod,
      reference: input.reference ?? null,
      receipt_url: input.receiptUrl ?? null,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();

  if (payErr || !payment) {
    return { paymentId: null, appliedInvoices: applications, surplus: remaining, error: `Error guardando pago: ${payErr?.message}` };
  }

  // 7. Create payment applications
  const appRows = applications.map((a) => ({
    tenant_id: tenantId,
    payment_id: payment.id,
    invoice_id: a.invoiceId,
    amount_applied: a.amountApplied,
  }));

  if (appRows.length > 0) {
    await supabase.from("payment_applications").insert(appRows);
  }

  return {
    paymentId: payment.id,
    appliedInvoices: applications,
    surplus: remaining,
    error: null,
  };
}

/**
 * Get payment history for a unit, optionally filtered by period.
 */
export async function getUnitPayments(
  unitId: string,
  period?: string
): Promise<{ payments: PaymentWithApplications[]; error: string | null }> {
  const supabase = createClient();

  let query = supabase
    .from("payments")
    .select(`
      *,
      payment_applications (
        id,
        invoice_id,
        amount_applied
      )
    `)
    .eq("unit_id", unitId)
    .order("payment_date", { ascending: false });

  if (period) {
    // Filter by period through applications
    query = query.filter("payment_applications.invoice_id", "not.is", null);
  }

  const { data, error } = await query;

  if (error) return { payments: [], error: error.message };
  return { payments: (data ?? []) as PaymentWithApplications[], error: null };
}

export interface PaymentWithApplications {
  id: string;
  unit_id: string;
  transaction_id: string | null;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference: string | null;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
  payment_applications: {
    id: string;
    invoice_id: string;
    amount_applied: number;
  }[];
}
