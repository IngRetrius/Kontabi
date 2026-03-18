import { createClient } from "@/lib/supabase/client";
import { getMapping } from "@/lib/accounting/mappings";
import { generateAllNarratives } from "@/lib/nls/engine";
import type { NarrativeContext } from "@/lib/nls/engine";
import { formatCOP } from "@/lib/utils/format";
import type {
  TransactionType,
  Transaction,
  JournalEntry,
  JournalEntryLine,
  Account,
} from "@/types/database";

// -- Types -------------------------------------------------------------------

export interface CreateTransactionInput {
  type: TransactionType;
  amount: number;
  date: string;
  description: string;
  unitId?: string;
  metadata?: Record<string, unknown>;
  /** Override default account codes for adjustments */
  debitAccountCode?: string;
  creditAccountCode?: string;
}

export interface CreateTransactionResult {
  transaction: Transaction;
  journalEntry: JournalEntry;
  lines: JournalEntryLine[];
  error: string | null;
}

// -- Helpers -----------------------------------------------------------------

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

async function resolveAccount(
  tenantId: string,
  code: string
): Promise<Account | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("accounts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("code", code)
    .eq("is_active", true)
    .single();

  return (data as Account) ?? null;
}

// -- Core engine -------------------------------------------------------------

/**
 * Creates a complete financial transaction:
 * 1. Resolves debit and credit accounts from the mapping
 * 2. Creates a journal entry with balanced lines
 * 3. Generates NLS narratives in 3 levels
 * 4. Creates the transaction record linked to the journal entry
 * 5. Confirms the journal entry (triggers balance validation)
 *
 * All operations are performed in sequence. If any step fails,
 * the Supabase RLS and constraints will prevent partial state.
 */
export async function createTransaction(
  input: CreateTransactionInput
): Promise<CreateTransactionResult> {
  const supabase = createClient();

  // 1. Resolve tenant
  const tenantId = await getTenantId();
  if (!tenantId) {
    return {
      transaction: {} as Transaction,
      journalEntry: {} as JournalEntry,
      lines: [],
      error: "No hay sesion activa o no se encontro el tenant",
    };
  }

  // 2. Resolve accounts
  const mapping = getMapping(input.type);
  const debitCode = input.debitAccountCode ?? mapping.debitCode;
  const creditCode = input.creditAccountCode ?? mapping.creditCode;

  const [debitAccount, creditAccount] = await Promise.all([
    resolveAccount(tenantId, debitCode),
    resolveAccount(tenantId, creditCode),
  ]);

  if (!debitAccount) {
    return {
      transaction: {} as Transaction,
      journalEntry: {} as JournalEntry,
      lines: [],
      error: `Cuenta debito no encontrada: ${debitCode}`,
    };
  }

  if (!creditAccount) {
    return {
      transaction: {} as Transaction,
      journalEntry: {} as JournalEntry,
      lines: [],
      error: `Cuenta credito no encontrada: ${creditCode}`,
    };
  }

  // 3. Generate entry number
  const { data: entryNumberData } = await supabase.rpc(
    "generate_entry_number",
    {
      p_tenant_id: tenantId,
      p_date: input.date,
    }
  );

  const entryNumber = (entryNumberData as string) ?? `${new Date().getFullYear()}-0001`;

  // 4. Create journal entry (draft)
  const { data: journalEntry, error: jeError } = await supabase
    .from("journal_entries")
    .insert({
      tenant_id: tenantId,
      entry_number: entryNumber,
      date: input.date,
      description: input.description,
      status: "draft",
    })
    .select()
    .single();

  if (jeError || !journalEntry) {
    return {
      transaction: {} as Transaction,
      journalEntry: {} as JournalEntry,
      lines: [],
      error: `Error creando asiento: ${jeError?.message ?? "desconocido"}`,
    };
  }

  // 5. Create journal entry lines (debit + credit)
  const linesToInsert = [
    {
      journal_entry_id: journalEntry.id,
      account_id: debitAccount.id,
      debit: input.amount,
      credit: 0,
      description: `${debitAccount.code} ${debitAccount.name}`,
    },
    {
      journal_entry_id: journalEntry.id,
      account_id: creditAccount.id,
      debit: 0,
      credit: input.amount,
      description: `${creditAccount.code} ${creditAccount.name}`,
    },
  ];

  const { data: lines, error: linesError } = await supabase
    .from("journal_entry_lines")
    .insert(linesToInsert)
    .select();

  if (linesError || !lines) {
    // Cleanup: delete the draft entry
    await supabase
      .from("journal_entries")
      .delete()
      .eq("id", journalEntry.id);

    return {
      transaction: {} as Transaction,
      journalEntry: {} as JournalEntry,
      lines: [],
      error: `Error creando lineas del asiento: ${linesError?.message ?? "desconocido"}`,
    };
  }

  // 6. Generate NLS narratives
  const metadata = input.metadata ?? {};
  const narrativeContext: NarrativeContext = {
    unit: (metadata.unit_label as string) ?? undefined,
    period: (metadata.period as string) ?? undefined,
    amount: formatCOP(input.amount),
    supplier: (metadata.supplier as string) ?? undefined,
    concept: input.description,
    balance: (metadata.balance as string) ?? undefined,
    months: (metadata.months as string) ?? undefined,
    method: (metadata.method as string) ?? undefined,
    reference: (metadata.reference as string) ?? undefined,
    account_debit: `${debitAccount.code} ${debitAccount.name}`,
    account_credit: `${creditAccount.code} ${creditAccount.name}`,
    entry_number: entryNumber,
  };

  const narratives = await generateAllNarratives(
    input.type,
    narrativeContext,
    tenantId
  );

  // 7. Create transaction
  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .insert({
      tenant_id: tenantId,
      type: input.type,
      amount: input.amount,
      date: input.date,
      description: input.description,
      unit_id: input.unitId ?? null,
      journal_entry_id: journalEntry.id,
      metadata,
      narratives,
    })
    .select()
    .single();

  if (txError || !transaction) {
    return {
      transaction: {} as Transaction,
      journalEntry: journalEntry as JournalEntry,
      lines: (lines as JournalEntryLine[]) ?? [],
      error: `Error creando transaccion: ${txError?.message ?? "desconocido"}`,
    };
  }

  // 8. Link journal entry to transaction
  await supabase
    .from("journal_entries")
    .update({ transaction_id: transaction.id })
    .eq("id", journalEntry.id);

  // 9. Confirm journal entry (triggers balance validation)
  const { error: confirmError } = await supabase
    .from("journal_entries")
    .update({ status: "confirmed" })
    .eq("id", journalEntry.id);

  if (confirmError) {
    return {
      transaction: transaction as Transaction,
      journalEntry: journalEntry as JournalEntry,
      lines: (lines as JournalEntryLine[]) ?? [],
      error: `Asiento creado pero no confirmado: ${confirmError.message}`,
    };
  }

  return {
    transaction: transaction as Transaction,
    journalEntry: { ...journalEntry, status: "confirmed" } as JournalEntry,
    lines: (lines as JournalEntryLine[]) ?? [],
    error: null,
  };
}

/**
 * Get account balances for all detail accounts in a tenant.
 * Calculates from journal_entry_lines of confirmed entries.
 */
export async function getAccountBalances(
  period?: string
): Promise<{ balances: AccountBalanceRow[]; error: string | null }> {
  const supabase = createClient();

  let query = supabase
    .from("journal_entry_lines")
    .select(
      `
      account_id,
      debit,
      credit,
      journal_entry:journal_entries!inner(
        id,
        date,
        status,
        tenant_id
      )
    `
    )
    .eq("journal_entry.status", "confirmed");

  if (period) {
    // Filter by period (YYYY-MM)
    const [year, month] = period.split("-");
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(Number(year), Number(month), 0)
      .toISOString()
      .split("T")[0];
    query = query
      .gte("journal_entry.date", startDate)
      .lte("journal_entry.date", endDate);
  }

  const { data, error } = await query;

  if (error) {
    return { balances: [], error: error.message };
  }

  // Aggregate by account
  const balanceMap = new Map<
    string,
    { debitTotal: number; creditTotal: number }
  >();

  for (const line of data ?? []) {
    const existing = balanceMap.get(line.account_id) ?? {
      debitTotal: 0,
      creditTotal: 0,
    };
    existing.debitTotal += Number(line.debit);
    existing.creditTotal += Number(line.credit);
    balanceMap.set(line.account_id, existing);
  }

  // Fetch account info
  const accountIds = Array.from(balanceMap.keys());
  if (accountIds.length === 0) {
    return { balances: [], error: null };
  }

  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, code, name, account_type, nature")
    .in("id", accountIds);

  const balances: AccountBalanceRow[] = (accounts ?? []).map((acc) => {
    const totals = balanceMap.get(acc.id) ?? {
      debitTotal: 0,
      creditTotal: 0,
    };
    // Balance depends on nature:
    // Debit-nature accounts: balance = debits - credits
    // Credit-nature accounts: balance = credits - debits
    const balance =
      acc.nature === "debito"
        ? totals.debitTotal - totals.creditTotal
        : totals.creditTotal - totals.debitTotal;

    return {
      accountId: acc.id,
      code: acc.code,
      name: acc.name,
      accountType: acc.account_type,
      nature: acc.nature,
      debitTotal: totals.debitTotal,
      creditTotal: totals.creditTotal,
      balance,
    };
  });

  // Sort by code
  balances.sort((a, b) => a.code.localeCompare(b.code));

  return { balances, error: null };
}

export interface AccountBalanceRow {
  accountId: string;
  code: string;
  name: string;
  accountType: string;
  nature: string;
  debitTotal: number;
  creditTotal: number;
  balance: number;
}
