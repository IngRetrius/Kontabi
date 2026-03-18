import { createClient } from "@/lib/supabase/client";
import type {
  NarrativeLevel,
  NarrativeTemplate,
  TransactionType,
  TransactionNarratives,
} from "@/types/database";

// -- Types -------------------------------------------------------------------

export interface NarrativeContext {
  unit?: string;
  period?: string;
  amount?: string;
  supplier?: string;
  concept?: string;
  balance?: string;
  months?: string;
  method?: string;
  reference?: string;
  account_debit?: string;
  account_credit?: string;
  entry_number?: string;
  [key: string]: string | undefined;
}

// -- Template cache ----------------------------------------------------------

let templateCache: NarrativeTemplate[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getTemplates(): Promise<NarrativeTemplate[]> {
  const now = Date.now();
  if (templateCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return templateCache;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("narrative_templates")
    .select("*")
    .order("tenant_id", { ascending: true, nullsFirst: true });

  if (error) {
    console.error("NLS: failed to fetch templates", error.message);
    return templateCache ?? [];
  }

  templateCache = (data as NarrativeTemplate[]) ?? [];
  cacheTimestamp = now;
  return templateCache;
}

// -- Core engine -------------------------------------------------------------

/**
 * Resolve the best template for a given operation and level.
 * Tenant-specific templates take priority over global (tenant_id=null).
 */
async function resolveTemplate(
  operationType: TransactionType,
  level: NarrativeLevel,
  tenantId?: string
): Promise<string | null> {
  const templates = await getTemplates();

  // First: try tenant-specific
  if (tenantId) {
    const tenantTemplate = templates.find(
      (t) =>
        t.operation_type === operationType &&
        t.level === level &&
        t.tenant_id === tenantId
    );
    if (tenantTemplate) return tenantTemplate.template;
  }

  // Fallback: global template
  const globalTemplate = templates.find(
    (t) =>
      t.operation_type === operationType &&
      t.level === level &&
      t.tenant_id === null
  );

  return globalTemplate?.template ?? null;
}

/**
 * Interpolate placeholders in a template string.
 * Replaces {key} with the corresponding value from context.
 * Unknown placeholders are left as-is.
 */
function interpolate(template: string, context: NarrativeContext): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = context[key];
    return value !== undefined ? value : match;
  });
}

/**
 * Generate a narrative for a single level.
 */
export async function generateNarrative(
  operationType: TransactionType,
  level: NarrativeLevel,
  context: NarrativeContext,
  tenantId?: string
): Promise<string> {
  const template = await resolveTemplate(operationType, level, tenantId);

  if (!template) {
    // Fallback: generic narrative
    const amount = context.amount ?? "";
    const concept = context.concept ?? operationType;
    return level === "accounting"
      ? `${operationType}: ${amount} - ${concept}`
      : `Movimiento registrado: ${amount} por ${concept}`;
  }

  return interpolate(template, context);
}

/**
 * Generate all three narrative levels at once.
 * This is the main function used by the accounting engine
 * when creating a transaction.
 */
export async function generateAllNarratives(
  operationType: TransactionType,
  context: NarrativeContext,
  tenantId?: string
): Promise<TransactionNarratives> {
  const [summary, detail, accounting] = await Promise.all([
    generateNarrative(operationType, "summary", context, tenantId),
    generateNarrative(operationType, "detail", context, tenantId),
    generateNarrative(operationType, "accounting", context, tenantId),
  ]);

  return { summary, detail, accounting };
}

/**
 * Invalidate the template cache.
 * Call this after updating templates in the database.
 */
export function invalidateTemplateCache(): void {
  templateCache = null;
  cacheTimestamp = 0;
}
