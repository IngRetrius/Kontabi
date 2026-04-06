import { createClient } from "@/lib/supabase/client";
import type { InvoiceStatus } from "@/types/database";

// -- Types -------------------------------------------------------------------

export type CertificationType = "paz_y_salvo" | "fondo_reserva" | "libro_diario";

export interface PazYSalvoData {
  type: "paz_y_salvo";
  unitNumber: string;
  tower: string | null;
  ownerName: string;
  ownerDocument: string;
  isUpToDate: boolean;
  pendingAmount: number;
  lastPaymentDate: string | null;
  certificationDate: string;
  tenantName: string;
  tenantNit: string;
  tenantAddress: string;
}

export interface FondoReservaData {
  type: "fondo_reserva";
  currentBalance: number;
  legalMinimum: number;
  budgetPercentage: number;
  status: string;
  movements: {
    date: string;
    description: string;
    type: "contribution" | "withdrawal";
    amount: number;
  }[];
  certificationDate: string;
  tenantName: string;
  tenantNit: string;
}

export interface LibroDiarioData {
  type: "libro_diario";
  period: string;
  entries: {
    entryNumber: string;
    date: string;
    description: string;
    lines: {
      accountCode: string;
      accountName: string;
      debit: number;
      credit: number;
    }[];
  }[];
  totalDebit: number;
  totalCredit: number;
  certificationDate: string;
  tenantName: string;
  tenantNit: string;
}

export type CertificationData = PazYSalvoData | FondoReservaData | LibroDiarioData;

// -- Generators --------------------------------------------------------------

export async function generatePazYSalvo(
  unitId: string
): Promise<{ data: PazYSalvoData | null; error: string | null }> {
  const supabase = createClient();

  // Get unit info
  const { data: unit } = await supabase
    .from("units")
    .select("number, building:buildings(name)")
    .eq("id", unitId)
    .single();

  if (!unit) return { data: null, error: "Unidad no encontrada" };

  // Get current owner
  const { data: owner } = await supabase
    .from("owners")
    .select("full_name, document_type, document_number")
    .eq("unit_id", unitId)
    .eq("is_current", true)
    .single();

  // Check pending invoices
  const { data: invoices } = await supabase
    .from("invoices")
    .select("total, paid_amount, status")
    .eq("unit_id", unitId)
    .in("status", ["pending", "partial", "overdue"] as InvoiceStatus[]);

  const pendingAmount = (invoices ?? []).reduce(
    (s, i) => s + (Number(i.total) - Number(i.paid_amount)),
    0
  );

  // Last payment date
  const { data: lastPayment } = await supabase
    .from("payments")
    .select("payment_date")
    .eq("unit_id", unitId)
    .order("payment_date", { ascending: false })
    .limit(1)
    .single();

  // Tenant info
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, nit, address")
    .limit(1)
    .single();

  return {
    data: {
      type: "paz_y_salvo",
      unitNumber: unit.number,
      tower: (unit.building as { name: string } | null)?.name ?? null,
      ownerName: owner?.full_name ?? "N/A",
      ownerDocument: owner
        ? `${owner.document_type.toUpperCase()} ${owner.document_number}`
        : "N/A",
      isUpToDate: pendingAmount === 0,
      pendingAmount,
      lastPaymentDate: lastPayment?.payment_date ?? null,
      certificationDate: new Date().toISOString().split("T")[0],
      tenantName: tenant?.name ?? "",
      tenantNit: tenant?.nit ?? "",
      tenantAddress: tenant?.address ?? "",
    },
    error: null,
  };
}

export async function generateFondoReserva(): Promise<{
  data: FondoReservaData | null;
  error: string | null;
}> {
  const supabase = createClient();

  const { data: fund } = await supabase
    .from("reserve_fund")
    .select("*")
    .limit(1)
    .single();

  if (!fund) return { data: null, error: "Fondo de reserva no configurado" };

  const { data: movements } = await supabase
    .from("reserve_fund_movements")
    .select("date, description, type, amount")
    .order("date", { ascending: false })
    .limit(50);

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, nit")
    .limit(1)
    .single();

  return {
    data: {
      type: "fondo_reserva",
      currentBalance: Number(fund.current_balance),
      legalMinimum: Number(fund.legal_minimum),
      budgetPercentage: Number(fund.budget_percentage),
      status: fund.status,
      movements: (movements ?? []).map((m) => ({
        date: m.date,
        description: m.description,
        type: m.type as "contribution" | "withdrawal",
        amount: Number(m.amount),
      })),
      certificationDate: new Date().toISOString().split("T")[0],
      tenantName: tenant?.name ?? "",
      tenantNit: tenant?.nit ?? "",
    },
    error: null,
  };
}

export async function generateLibroDiario(
  period: string
): Promise<{ data: LibroDiarioData | null; error: string | null }> {
  const supabase = createClient();
  const [year, month] = period.split("-").map(Number);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];

  const { data: entries } = await supabase
    .from("journal_entries")
    .select(`
      id, entry_number, date, description, status,
      journal_entry_lines (
        account_id,
        debit,
        credit,
        description,
        account:accounts!inner(code, name)
      )
    `)
    .eq("status", "confirmed")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date");

  if (!entries || entries.length === 0) {
    return { data: null, error: "No hay asientos confirmados en este periodo" };
  }

  let totalDebit = 0;
  let totalCredit = 0;

  const formattedEntries = entries.map((e) => {
    const rawLines = (e.journal_entry_lines ?? []) as unknown as {
      account_id: string;
      debit: number;
      credit: number;
      description: string | null;
      account: { code: string; name: string };
    }[];
    const lines = rawLines.map((l) => {
      totalDebit += Number(l.debit);
      totalCredit += Number(l.credit);
      return {
        accountCode: l.account.code,
        accountName: l.account.name,
        debit: Number(l.debit),
        credit: Number(l.credit),
      };
    });

    return {
      entryNumber: e.entry_number,
      date: e.date,
      description: e.description,
      lines,
    };
  });

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, nit")
    .limit(1)
    .single();

  return {
    data: {
      type: "libro_diario",
      period,
      entries: formattedEntries,
      totalDebit,
      totalCredit,
      certificationDate: new Date().toISOString().split("T")[0],
      tenantName: tenant?.name ?? "",
      tenantNit: tenant?.nit ?? "",
    },
    error: null,
  };
}
