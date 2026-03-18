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
