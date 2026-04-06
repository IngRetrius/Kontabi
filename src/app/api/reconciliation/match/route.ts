import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runMatchingEngine } from "@/lib/reconciliation/matching-engine";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Verify auth
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const { statementId, dateTolerance, scoreThreshold } = body;

  if (!statementId) {
    return NextResponse.json(
      { error: "statementId es requerido" },
      { status: 400 }
    );
  }

  const { results, error } = await runMatchingEngine(statementId, {
    dateTolerance,
    scoreThreshold,
  });

  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }

  return NextResponse.json({ results });
}
