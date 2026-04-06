import { createClient } from "@/lib/supabase/client";
import type { SettingKey } from "@/types/database";

const DEFAULTS: Record<SettingKey, string> = {
  billing_cutoff_day: "1",
  payment_due_day: "15",
  late_fee_rate: "1.5",
  grace_period_days: "5",
  late_fee_type: "simple",
  invoice_advance_days: "5",
  overdue_reminder_days: "3",
  report_header_text: "",
  primary_color: "#1a1a1a",
  logo_pdf_url: "",
  period_lock_date: "",
  reconciliation_date_tolerance: "3",
  reconciliation_score_threshold: "40",
};

export function getDefault(key: SettingKey): string {
  return DEFAULTS[key];
}

export async function getSettings(
  keys: SettingKey[]
): Promise<Record<SettingKey, string>> {
  const supabase = createClient();
  const { data } = await supabase
    .from("tenant_settings")
    .select("key, value")
    .in("key", keys);

  const result = {} as Record<SettingKey, string>;
  for (const key of keys) {
    const found = data?.find((s) => s.key === key);
    result[key] = found?.value ?? DEFAULTS[key];
  }
  return result;
}

export async function saveSettings(
  settings: Partial<Record<SettingKey, string>>
): Promise<{ error: string | null }> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "No hay sesion activa" };

  const { data: userData } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("auth_id", user.id)
    .single();
  if (!userData) return { error: "No se encontro el tenant" };

  const entries = Object.entries(settings).filter(
    ([, v]) => v !== undefined
  ) as [string, string][];

  for (const [key, value] of entries) {
    const { error } = await supabase.from("tenant_settings").upsert(
      { tenant_id: userData.tenant_id, key, value },
      { onConflict: "tenant_id,key" }
    );
    if (error) return { error: error.message };
  }

  return { error: null };
}
