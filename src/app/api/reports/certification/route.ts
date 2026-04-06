import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generatePazYSalvo,
  generateFondoReserva,
  generateLibroDiario,
  type CertificationType,
} from "@/lib/reports/certifications";

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
  const { type, unitId, period } = body as {
    type: CertificationType;
    unitId?: string;
    period?: string;
  };

  if (!type) {
    return NextResponse.json(
      { error: "Tipo de certificacion requerido" },
      { status: 400 }
    );
  }

  switch (type) {
    case "paz_y_salvo": {
      if (!unitId) {
        return NextResponse.json(
          { error: "unitId es requerido para paz y salvo" },
          { status: 400 }
        );
      }
      const { data, error } = await generatePazYSalvo(unitId);
      if (error) return NextResponse.json({ error }, { status: 500 });
      return NextResponse.json({ data });
    }
    case "fondo_reserva": {
      const { data, error } = await generateFondoReserva();
      if (error) return NextResponse.json({ error }, { status: 500 });
      return NextResponse.json({ data });
    }
    case "libro_diario": {
      if (!period) {
        return NextResponse.json(
          { error: "period es requerido para libro diario" },
          { status: 400 }
        );
      }
      const { data, error } = await generateLibroDiario(period);
      if (error) return NextResponse.json({ error }, { status: 500 });
      return NextResponse.json({ data });
    }
    default:
      return NextResponse.json(
        { error: `Tipo de certificacion no soportado: ${type}` },
        { status: 400 }
      );
  }
}
