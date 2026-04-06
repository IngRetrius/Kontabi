import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

/**
 * POST /api/cron/mark-overdue
 *
 * Marks all pending/partial invoices past their due date as "overdue".
 * Can be called via Vercel Cron, manual trigger, or on dashboard load.
 */
export async function POST() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("mark_overdue_invoices");

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      affected: data as number,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return POST();
}
