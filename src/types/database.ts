export type UserRole = "super_admin" | "admin" | "board" | "resident";

export interface Tenant {
  id: string;
  name: string;
  nit: string;
  address: string;
  city: string;
  department: string;
  stratum: number;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Building {
  id: string;
  tenant_id: string;
  name: string;
  floors: number;
  created_at: string;
  updated_at: string;
}

export type UnitType = "apartment" | "commercial" | "parking" | "storage";

export interface Unit {
  id: string;
  tenant_id: string;
  building_id: string;
  number: string;
  floor: number;
  unit_type: UnitType;
  area_m2: number;
  coefficient: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Owner {
  id: string;
  tenant_id: string;
  unit_id: string;
  full_name: string;
  document_type: "cc" | "ce" | "nit" | "passport";
  document_number: string;
  email: string | null;
  phone: string | null;
  is_current: boolean;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantSetting {
  id: string;
  tenant_id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

export type SettingKey =
  | "billing_cutoff_day"
  | "payment_due_day"
  | "late_fee_rate"
  | "grace_period_days"
  | "late_fee_type"
  | "invoice_advance_days"
  | "overdue_reminder_days"
  | "report_header_text"
  | "primary_color"
  | "logo_pdf_url"
  | "period_lock_date"
  | "reconciliation_date_tolerance"
  | "reconciliation_score_threshold";

export interface CommonArea {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  schedule: string | null;
  booking_cost: number;
  deposit: number;
  is_bookable: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  tenant_id: string;
  user_id: string | null;
  table_name: string;
  record_id: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

// -- Accounting (P2) --------------------------------------------------------

export type AccountType =
  | "activo"
  | "pasivo"
  | "patrimonio"
  | "ingreso"
  | "gasto";

export type AccountNature = "debito" | "credito";

export interface Account {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  account_type: AccountType;
  nature: AccountNature;
  parent_id: string | null;
  level: number;
  is_detail: boolean;
  is_active: boolean;
  is_system: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export type TransactionType =
  | "quota_payment"
  | "extraordinary_payment"
  | "supplier_payment"
  | "utility_payment"
  | "payroll"
  | "reserve_fund_contribution"
  | "late_interest"
  | "common_area_rental"
  | "bank_fee"
  | "depreciation"
  | "insurance"
  | "maintenance"
  | "security"
  | "cleaning"
  | "legal"
  | "admin_expense"
  | "other_income"
  | "other_expense"
  | "adjustment";

export type JournalEntryStatus = "draft" | "confirmed";

export interface Transaction {
  id: string;
  tenant_id: string;
  type: TransactionType;
  amount: number;
  date: string;
  description: string;
  unit_id: string | null;
  journal_entry_id: string | null;
  metadata: Record<string, unknown>;
  narratives: TransactionNarratives | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionNarratives {
  summary: string;
  detail: string;
  accounting: string;
}

export interface JournalEntry {
  id: string;
  tenant_id: string;
  entry_number: string;
  date: string;
  description: string;
  status: JournalEntryStatus;
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
  description: string | null;
  created_at: string;
}

export type NarrativeLevel = "summary" | "detail" | "accounting";

export interface NarrativeTemplate {
  id: string;
  tenant_id: string | null;
  operation_type: TransactionType;
  level: NarrativeLevel;
  template: string;
  created_at: string;
  updated_at: string;
}

export interface NlsDictionaryEntry {
  id: string;
  accounting_term: string;
  simple_translation: string;
  example: string | null;
  category: string;
  created_at: string;
}

export interface AccountBalance {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  period: string;
  debit_total: number;
  credit_total: number;
  balance: number;
  tenant_id: string;
}

// -- Budgets & Law 675 (P4) ---------------------------------------------------

export type BudgetStatus = "draft" | "approved" | "active";

export type BudgetItemCategory =
  | "payroll"
  | "security"
  | "cleaning"
  | "maintenance"
  | "utilities"
  | "insurance"
  | "admin"
  | "legal"
  | "reserve_fund"
  | "other";

export interface Budget {
  id: string;
  tenant_id: string;
  year: number;
  name: string;
  status: BudgetStatus;
  total: number;
  reserve_fund_pct: number;
  notes: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetItem {
  id: string;
  tenant_id: string;
  budget_id: string;
  account_id: string | null;
  name: string;
  category: BudgetItemCategory;
  monthly_amount: number;
  annual_amount: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = "pending" | "partial" | "paid" | "overdue";

export interface Invoice {
  id: string;
  tenant_id: string;
  unit_id: string;
  budget_id: string | null;
  period: string;
  quota_amount: number;
  extraordinary_amount: number;
  late_fee_amount: number;
  total: number;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  paid_date: string | null;
  paid_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ReserveFundStatus = "compliant" | "below_minimum" | "critical";

export interface ReserveFund {
  id: string;
  tenant_id: string;
  current_balance: number;
  legal_minimum: number;
  budget_percentage: number;
  status: ReserveFundStatus;
  created_at: string;
  updated_at: string;
}

export type ReserveFundMovementType = "contribution" | "withdrawal";

export interface ReserveFundMovement {
  id: string;
  tenant_id: string;
  type: ReserveFundMovementType;
  amount: number;
  date: string;
  description: string;
  assembly_act_id: string | null;
  journal_entry_id: string | null;
  created_at: string;
}

export type ExtraordinaryFeeDistribution = "coefficient" | "equal";
export type ExtraordinaryFeeStatus = "active" | "completed" | "cancelled";

export interface ExtraordinaryFee {
  id: string;
  tenant_id: string;
  concept: string;
  total_amount: number;
  distribution: ExtraordinaryFeeDistribution;
  start_date: string;
  installments: number;
  assembly_act_id: string | null;
  status: ExtraordinaryFeeStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ExtraordinaryFeeUnitStatus = "pending" | "partial" | "paid";

export interface ExtraordinaryFeeUnit {
  id: string;
  tenant_id: string;
  fee_id: string;
  unit_id: string;
  total_amount: number;
  installment_amount: number;
  paid_installments: number;
  paid_amount: number;
  balance: number;
  status: ExtraordinaryFeeUnitStatus;
  created_at: string;
  updated_at: string;
}

export type AssemblyActType = "ordinary" | "extraordinary";

export interface AssemblyActDecision {
  decision: string;
  votes_for: number;
  votes_against: number;
  approved: boolean;
}

export interface AssemblyAct {
  id: string;
  tenant_id: string;
  type: AssemblyActType;
  act_number: string;
  date: string;
  quorum: number;
  description: string;
  decisions: AssemblyActDecision[];
  document_url: string | null;
  attendees_count: number | null;
  total_coefficient: number | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// P5 — Cartera, Indicadores y Mora
// ---------------------------------------------------------------------------

export type PaymentMethod = "transfer" | "deposit" | "cash" | "other";

export interface Payment {
  id: string;
  tenant_id: string;
  unit_id: string;
  transaction_id: string | null;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference: string | null;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentApplication {
  id: string;
  tenant_id: string;
  payment_id: string;
  invoice_id: string;
  amount_applied: number;
  created_at: string;
}

export type HealthIndicatorLevel = "green" | "yellow" | "red";

export interface HealthIndicator {
  key: string;
  name: string;
  value: number;
  formatted: string;
  level: HealthIndicatorLevel;
  description: string;
}

export type AgingBucket =
  | "current"
  | "30"
  | "60"
  | "90"
  | "180"
  | "over_180";

export interface AgingEntry {
  bucket: AgingBucket;
  label: string;
  amount: number;
  count: number;
  provision_pct: number;
  provision_amount: number;
}

export interface UnitStatement {
  unit_id: string;
  unit_number: string;
  owner_name: string | null;
  coefficient: number;
  total_charged: number;
  total_paid: number;
  balance: number;
  invoices: (Invoice & { applications: PaymentApplication[] })[];
}

// ---------------------------------------------------------------------------
// P6 — Conciliacion Bancaria y Auditoria
// ---------------------------------------------------------------------------

export type BankAccountType = "corriente" | "ahorros";

export interface BankAccount {
  id: string;
  tenant_id: string;
  bank_name: string;
  account_number: string;
  account_type: BankAccountType;
  account_id: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type StatementStatus = "pending" | "in_progress" | "reconciled";

export interface BankStatement {
  id: string;
  tenant_id: string;
  bank_account_id: string | null;
  bank_name: string;
  period: string;
  file_url: string | null;
  file_name: string | null;
  total_lines: number;
  total_debits: number;
  total_credits: number;
  status: StatementStatus;
  imported_at: string;
  reconciled_at: string | null;
  reconciled_by: string | null;
  created_at: string;
  updated_at: string;
}

export type LineType = "debit" | "credit";
export type MatchStatus = "pending" | "matched" | "manual" | "excluded";

export interface BankStatementLine {
  id: string;
  statement_id: string;
  tenant_id: string;
  line_date: string;
  description: string;
  reference: string | null;
  amount: number;
  line_type: LineType;
  balance: number | null;
  match_status: MatchStatus;
  matched_transaction_id: string | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export type ReconciliationMatchType = "auto" | "manual";

export interface ReconciliationMatch {
  id: string;
  tenant_id: string;
  statement_line_id: string;
  transaction_id: string;
  score: number;
  match_type: ReconciliationMatchType;
  confirmed: boolean;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_at: string;
}

export interface PeriodLock {
  id: string;
  tenant_id: string;
  period: string;
  locked_at: string;
  locked_by: string;
  reason: string | null;
  reconciliation_done: boolean;
  balances_verified: boolean;
  provision_calculated: boolean;
  created_at: string;
}

export type ConfidenceLevel = "high" | "medium" | "low";

export interface MatchCandidate {
  transactionId: string;
  score: number;
  confidence: ConfidenceLevel;
  amountMatch: boolean;
  dateDistance: number;
  referenceScore: number;
}

export interface ParsedStatementLine {
  date: string;
  description: string;
  reference: string;
  amount: number;
  type: LineType;
  balance?: number;
  rawData: Record<string, unknown>;
}

export type BankFormat = "bancolombia" | "davivienda" | "bbva" | "generic";

export interface ParseResult {
  bank: BankFormat;
  lines: ParsedStatementLine[];
  totalDebits: number;
  totalCredits: number;
  errors: string[];
}
