"use client";

import { useEffect, useMemo, useState } from "react";

interface ShowcaseSlide {
  label: string;
  section: string;
  path: string;
  focus: string;
  movements: Array<{
    unit: string;
    concept: string;
    amount: string;
    status: "ok" | "warn";
  }>;
  bars: number[];
}

interface ShowcaseKpi {
  label: string;
  value: string;
  note: string;
  tone: "green" | "yellow" | "red";
}

const SHOWCASE_SLIDES: ShowcaseSlide[] = [
  {
    label: "Dashboard principal",
    section: "Resumen",
    path: "/dashboard",
    focus: "Vision general del estado financiero del conjunto.",
    movements: [
      { unit: "Apto 301", concept: "Cuota ordinaria", amount: "$1.500.000", status: "ok" },
      { unit: "Apto 204", concept: "Interes de mora", amount: "$95.000", status: "warn" },
      { unit: "Apto 1102", concept: "Parqueadero", amount: "$280.000", status: "ok" },
    ],
    bars: [38, 46, 55, 61, 66, 73, 78],
  },
  {
    label: "Libro de transacciones",
    section: "Transacciones",
    path: "/dashboard/financials",
    focus: "Trazabilidad detallada de cada movimiento contable.",
    movements: [
      { unit: "Apto 504", concept: "Ajuste contable", amount: "$320.000", status: "warn" },
      { unit: "Apto 207", concept: "Pago extraordinario", amount: "$780.000", status: "ok" },
      { unit: "Apto 901", concept: "Recaudo cuota", amount: "$1.250.000", status: "ok" },
    ],
    bars: [28, 40, 47, 59, 63, 69, 74],
  },
  {
    label: "Planeacion presupuestal anual",
    section: "Presupuesto",
    path: "/dashboard/budget",
    focus: "Control presupuestal anual con desviaciones visibles.",
    movements: [
      { unit: "Mantenimiento", concept: "Ejecutado", amount: "$8.200.000", status: "ok" },
      { unit: "Seguridad", concept: "Sobre ejecucion", amount: "$2.100.000", status: "warn" },
      { unit: "Aseo", concept: "Ejecutado", amount: "$3.400.000", status: "ok" },
    ],
    bars: [32, 36, 44, 56, 60, 67, 72],
  },
  {
    label: "Dashboard de cartera",
    section: "Cartera",
    path: "/dashboard/overview",
    focus: "Seguimiento de morosidad por unidad y antiguedad.",
    movements: [
      { unit: "Apto 703", concept: "Mora 30-60 dias", amount: "$1.980.000", status: "warn" },
      { unit: "Apto 305", concept: "Mora 1-30 dias", amount: "$740.000", status: "warn" },
      { unit: "Apto 1201", concept: "Pago total", amount: "$1.620.000", status: "ok" },
    ],
    bars: [24, 31, 42, 51, 59, 66, 70],
  },
  {
    label: "Gestion de cobros",
    section: "Cobros",
    path: "/dashboard/payments",
    focus: "Estrategia de recaudo activa con alertas de seguimiento.",
    movements: [
      { unit: "Apto 808", concept: "Recordatorio enviado", amount: "$1.150.000", status: "warn" },
      { unit: "Apto 102", concept: "Promesa de pago", amount: "$940.000", status: "warn" },
      { unit: "Apto 409", concept: "Pago confirmado", amount: "$1.420.000", status: "ok" },
    ],
    bars: [20, 27, 36, 44, 53, 61, 68],
  },
  {
    label: "Registro de pagos",
    section: "Registrar pago",
    path: "/dashboard/payments/new",
    focus: "Registro rapido de pagos con validacion automatica.",
    movements: [
      { unit: "Apto 1104", concept: "Transferencia PSE", amount: "$1.500.000", status: "ok" },
      { unit: "Apto 602", concept: "Pago parcial", amount: "$650.000", status: "warn" },
      { unit: "Apto 201", concept: "Pago completo", amount: "$1.300.000", status: "ok" },
    ],
    bars: [35, 39, 46, 58, 64, 71, 79],
  },
  {
    label: "Indicadores financieros",
    section: "Indicadores",
    path: "/dashboard/indicators",
    focus: "KPIs financieros y operativos en tiempo real.",
    movements: [
      { unit: "Liquidez", concept: "Indice actual", amount: "1.42", status: "ok" },
      { unit: "Cartera", concept: "Nivel de riesgo", amount: "18%", status: "warn" },
      { unit: "Recaudo", concept: "Cumplimiento", amount: "92%", status: "ok" },
    ],
    bars: [30, 34, 43, 52, 61, 70, 76],
  },
  {
    label: "Centro de reportes",
    section: "Reportes",
    path: "/dashboard/reports",
    focus: "Reportes listos para asamblea y revisoria fiscal.",
    movements: [
      { unit: "Balance", concept: "Generado", amount: "Marzo 2026", status: "ok" },
      { unit: "Estado cartera", concept: "Pendiente firma", amount: "Hoy", status: "warn" },
      { unit: "Flujo caja", concept: "Publicado", amount: "Ultima semana", status: "ok" },
    ],
    bars: [26, 33, 41, 50, 58, 66, 74],
  },
];

const KPI_BY_PATH: Record<string, ShowcaseKpi[]> = {
  "/dashboard": [
    { label: "Liquidez", value: "1.42", note: "Capacidad de pago", tone: "green" },
    { label: "Cartera vencida", value: "18%", note: "Nivel de mora", tone: "yellow" },
    { label: "Recaudo mensual", value: "92%", note: "Meta del mes", tone: "green" },
  ],
  "/dashboard/financials": [
    { label: "Asientos", value: "146", note: "Periodo actual", tone: "green" },
    { label: "Ajustes", value: "9", note: "Requieren revision", tone: "yellow" },
    { label: "Balance", value: "OK", note: "Sin descuadres", tone: "green" },
  ],
  "/dashboard/budget": [
    { label: "Ejecucion", value: "74%", note: "Vs plan anual", tone: "yellow" },
    { label: "Desviacion", value: "+6%", note: "Sobre presupuesto", tone: "yellow" },
    { label: "Cumplimiento", value: "89%", note: "Objetivo global", tone: "green" },
  ],
  "/dashboard/overview": [
    { label: "Mora 30+", value: "$5.2M", note: "Saldo vencido", tone: "yellow" },
    { label: "Unidades en mora", value: "27", note: "Total actual", tone: "yellow" },
    { label: "Recuperacion", value: "81%", note: "Ultimo corte", tone: "green" },
  ],
  "/dashboard/payments": [
    { label: "Cobros activos", value: "38", note: "Gestiones abiertas", tone: "green" },
    { label: "Promesas", value: "12", note: "Pendientes", tone: "yellow" },
    { label: "Efectividad", value: "76%", note: "Ultimos 30 dias", tone: "green" },
  ],
  "/dashboard/payments/new": [
    { label: "Pagos hoy", value: "19", note: "Registros creados", tone: "green" },
    { label: "Validaciones", value: "3", note: "Requieren ajuste", tone: "yellow" },
    { label: "Tiempo promedio", value: "1.8m", note: "Por registro", tone: "green" },
  ],
  "/dashboard/indicators": [
    { label: "Estado general", value: "Regular", note: "Semaforo global", tone: "yellow" },
    { label: "Provision", value: "$6.9M", note: "Sugerida", tone: "green" },
    { label: "Riesgo", value: "Controlado", note: "Nivel actual", tone: "green" },
  ],
  "/dashboard/reports": [
    { label: "Reportes mes", value: "14", note: "Generados", tone: "green" },
    { label: "Pendientes", value: "2", note: "Por firma", tone: "yellow" },
    { label: "Cumplimiento", value: "94%", note: "Entrega oportuna", tone: "green" },
  ],
};

const KPI_TONE_CLASS: Record<ShowcaseKpi["tone"], string> = {
  green: "text-emerald-600",
  yellow: "text-amber-600",
  red: "text-red-600",
};

function nextIndex(index: number): number {
  return (index + 1) % SHOWCASE_SLIDES.length;
}

export function DashboardShowcaseCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;

    const timer = window.setInterval(() => {
      setActive((current) => nextIndex(current));
    }, 4500);

    return () => window.clearInterval(timer);
  }, [paused]);

  const current = useMemo(() => SHOWCASE_SLIDES[active], [active]);
  const kpis = useMemo(
    () => KPI_BY_PATH[current.path] ?? KPI_BY_PATH["/dashboard"],
    [current.path]
  );

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border bg-background font-body shadow-[0_25px_60px_-12px_rgba(0,0,0,0.15)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/50">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-foreground/20" />
          <div className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <div className="h-2.5 w-2.5 rounded-full bg-foreground/10" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="max-w-full truncate rounded bg-muted px-3 py-0.5 text-[10px] text-muted-foreground">
            <span className="sm:hidden">kontabi.app/dashboard</span>
            <span className="hidden sm:inline">{`kontabi.app${current.path}`}</span>
          </div>
        </div>
      </div>

      <div className="p-1 sm:p-2">
        <div className="rounded-lg border border-border bg-muted/25 p-3 sm:hidden">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-sm text-foreground">Resumen Financiero</p>
            <span className="rounded bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
              Marzo 2026
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-border bg-background p-2">
              <p className="text-[10px] text-muted-foreground">Ingresos mes</p>
              <p className="mt-1 text-xs font-semibold text-foreground">$42.8M</p>
            </div>
            <div className="rounded-md border border-border bg-background p-2">
              <p className="text-[10px] text-muted-foreground">Cartera</p>
              <p className="mt-1 text-xs font-semibold text-foreground">$8.2M</p>
            </div>
          </div>

          <div className="mt-3 rounded-md border border-border bg-background p-2">
            <div className="mb-2 h-1.5 w-20 rounded-full bg-foreground/15" />
            <div className="space-y-1.5">
              <div className="h-1.5 w-full rounded-full bg-muted" />
              <div className="h-1.5 w-11/12 rounded-full bg-muted" />
              <div className="h-1.5 w-8/12 rounded-full bg-muted" />
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <div className="h-2 w-full rounded bg-foreground/10" />
            <div className="h-2 w-10/12 rounded bg-foreground/10" />
            <div className="h-2 w-9/12 rounded bg-foreground/10" />
          </div>
        </div>

        <div className="hidden rounded-lg border border-border bg-muted/25 p-3 sm:block lg:p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border border-border bg-background p-3 md:col-span-1">
              <p className="mb-3 font-display text-sm text-foreground">Kontabi</p>
              <div className="space-y-1">
                {SHOWCASE_SLIDES.map((slide, index) => (
                  <button
                    key={slide.path}
                    type="button"
                    onClick={() => setActive(index)}
                    className={`block w-full rounded-md px-2 py-1.5 text-left text-[11px] transition-colors ${
                      active === index
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {slide.section}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 md:col-span-3">
              <div className="grid grid-cols-3 gap-2">
                {kpis.map((kpi) => (
                  <div key={`${current.path}-${kpi.label}`} className="rounded-md border border-border bg-background p-2.5">
                    <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
                    <p className={`mt-1 text-sm font-semibold ${KPI_TONE_CLASS[kpi.tone]}`}>{kpi.value}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{kpi.note}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-md border border-border bg-background p-3 lg:col-span-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-foreground">Tendencia mensual</p>
                    <span className="text-[10px] text-muted-foreground">Ultimos 7 cortes</span>
                  </div>
                  <div className="mt-3 flex h-28 items-end gap-2">
                    {current.bars.map((value, index) => (
                      <div
                        key={`${current.section}-bar-${index}`}
                        className="flex-1 rounded-t-sm bg-foreground/75"
                        style={{ height: `${value}%` }}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-md border border-border bg-background p-3">
                  <p className="text-xs font-semibold text-foreground">Vista activa</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">{current.label}</p>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{current.focus}</p>
                </div>
              </div>

              <div className="rounded-md border border-border bg-background p-3">
                <div className="mb-2 grid grid-cols-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <p>Unidad</p>
                  <p>Concepto</p>
                  <p className="text-right">Valor</p>
                </div>
                <div className="space-y-1.5">
                  {current.movements.map((row) => (
                    <div
                      key={`${current.section}-${row.unit}-${row.concept}`}
                      className="grid grid-cols-3 items-center rounded-md border border-border/70 px-2 py-1.5 text-[11px]"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${row.status === "ok" ? "bg-foreground" : "bg-muted-foreground"}`}
                        />
                        <span className="text-foreground">{row.unit}</span>
                      </div>
                      <p className="text-muted-foreground">{row.concept}</p>
                      <p className="text-right font-medium text-foreground">{row.amount}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
