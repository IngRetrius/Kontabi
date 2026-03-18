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
  | "logo_pdf_url";

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
