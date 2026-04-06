import { createClient } from "@/lib/supabase/client";
import { getSettings } from "@/lib/settings/tenant-settings";

export interface TenantHeaderData {
  tenantName: string;
  tenantNit: string;
  tenantAddress: string;
  reportHeaderText: string;
  primaryColor: string;
  logoUrl: string;
  adminName: string;
}

export async function loadTenantHeader(): Promise<{
  data: TenantHeaderData | null;
  error: string | null;
}> {
  const supabase = createClient();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, nit, address")
    .limit(1)
    .single();

  if (!tenant) return { data: null, error: "No se encontro informacion del conjunto" };

  const settings = await getSettings([
    "report_header_text",
    "primary_color",
    "logo_pdf_url",
  ]);

  // Get admin name from current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let adminName = "";
  if (user) {
    const { data: userData } = await supabase
      .from("users")
      .select("full_name")
      .eq("auth_id", user.id)
      .single();
    adminName = userData?.full_name ?? "";
  }

  return {
    data: {
      tenantName: tenant.name ?? "",
      tenantNit: tenant.nit ?? "",
      tenantAddress: tenant.address ?? "",
      reportHeaderText: settings.report_header_text,
      primaryColor: settings.primary_color,
      logoUrl: settings.logo_pdf_url,
      adminName,
    },
    error: null,
  };
}
