"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { usePageTransition } from "@/hooks/use-page-transition";
import {
  FileText,
  ShieldCheck,
  BookOpen,
  Shield,
  TrendingUp,
  Scale,
  BarChart3,
  Clock,
  FileBarChart,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ReportCard } from "@/components/reports/report-card";
import { ReportPreviewDialog } from "@/components/reports/report-preview-dialog";
import { loadTenantHeader, type TenantHeaderData } from "@/lib/reports/report-header";
import { today } from "@/lib/pdf/helpers";

// -- Types -------------------------------------------------------------------

interface PreviewState {
  title: string;
  pdfDocument: React.JSX.Element;
  fileName: string;
}

interface UnitOption {
  id: string;
  number: string;
}

// -- Helpers -----------------------------------------------------------------

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function periodOptions(): { value: string; label: string }[] {
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const now = new Date();
  const opts: { value: string; label: string }[] = [];
  for (let offset = 0; offset < 24; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    opts.push({ value: val, label: `${months[d.getMonth()]} ${d.getFullYear()}` });
  }
  return opts;
}

function monthOptions(): { value: number; label: string }[] {
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const current = new Date().getMonth() + 1;
  return months.slice(0, current).map((m, i) => ({ value: i + 1, label: m }));
}

const selectClass =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30";

// -- Component ---------------------------------------------------------------

export default function ReportsCenterPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [header, setHeader] = useState<TenantHeaderData | null>(null);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  // Per-card parameters
  const [statementUnit, setStatementUnit] = useState("");
  const [pazUnit, setPazUnit] = useState("");
  const [diarioPeriod, setDiarioPeriod] = useState(currentPeriod());
  const [incomePeriod, setIncomePeriod] = useState(currentPeriod());
  const [trialPeriod, setTrialPeriod] = useState(currentPeriod());
  const [execMonth, setExecMonth] = useState(new Date().getMonth() + 1);

  // Load header + units on mount
  useEffect(() => {
    loadTenantHeader().then(({ data }) => {
      if (data) setHeader(data);
    });

    const supabase = createClient();
    supabase
      .from("units")
      .select("id, number")
      .order("number")
      .then(({ data }) => {
        const list = (data ?? []).map((u) => ({ id: u.id, number: u.number }));
        setUnits(list);
        if (list.length > 0) {
          setStatementUnit(list[0].id);
          setPazUnit(list[0].id);
        }
      });
  }, []);

  const periods = periodOptions();
  const months = monthOptions();

  // -- Generators ------------------------------------------------------------

  const generate = useCallback(
    async (reportId: string) => {
      if (!header) {
        setError("No se pudo cargar la informacion del conjunto");
        return;
      }
      setLoading(reportId);
      setError(null);

      try {
        let pdfElement: React.JSX.Element | null = null;
        let title = "";
        let fileName = "";

        switch (reportId) {
          // 1. Estado de Cuenta
          case "account-statement": {
            const { getUnitStatement } = await import(
              "@/lib/accounting/account-statement"
            );
            const result = await getUnitStatement(statementUnit);
            if (result.error) throw new Error(result.error);
            const { default: Pdf } = await import(
              "@/components/pdf/account-statement-pdf"
            );
            title = `Estado de Cuenta - Unidad ${result.unitNumber}`;
            fileName = `estado-cuenta-${result.unitNumber}-${today()}.pdf`;
            pdfElement = (
              <Pdf
                data={result}
                tenantName={header.tenantName}
                tenantNit={header.tenantNit}
                tenantAddress={header.tenantAddress}
                generatedDate={today()}
                adminName={header.adminName}
              />
            );
            break;
          }

          // 2. Paz y Salvo
          case "paz-y-salvo": {
            const { generatePazYSalvo } = await import(
              "@/lib/reports/certifications"
            );
            const { data, error: err } = await generatePazYSalvo(pazUnit);
            if (err || !data) throw new Error(err ?? "Error generando paz y salvo");
            const { default: Pdf } = await import(
              "@/components/pdf/paz-y-salvo-pdf"
            );
            title = `Paz y Salvo - Unidad ${data.unitNumber}`;
            fileName = `paz-y-salvo-${data.unitNumber}-${today()}.pdf`;
            pdfElement = <Pdf data={data} />;
            break;
          }

          // 3. Libro Diario
          case "libro-diario": {
            const { generateLibroDiario } = await import(
              "@/lib/reports/certifications"
            );
            const { data, error: err } = await generateLibroDiario(diarioPeriod);
            if (err || !data) throw new Error(err ?? "No hay asientos en este periodo");
            const { default: Pdf } = await import(
              "@/components/pdf/reconciliation-report-pdf"
            );
            // Libro diario uses its own PDF -- we need a dedicated one
            // For now, let's reuse the certifications data with a simple structure
            // Actually, libro diario needs its own PDF. Let me create a simple wrapper.
            // Since we don't have a dedicated libro-diario-pdf, we'll create inline.
            const { Document, Page: PdfPage, View, Text: PdfText } = await import(
              "@react-pdf/renderer"
            );
            const { PdfHeader } = await import("@/components/pdf/pdf-header");
            const { PdfFooter } = await import("@/components/pdf/pdf-footer");
            const { baseStyles, PDF_COLORS } = await import("@/lib/pdf/styles");
            const { fmtCOP, fmtDate, fmtPeriod } = await import("@/lib/pdf/helpers");

            title = `Libro Diario - ${fmtPeriod(diarioPeriod)}`;
            fileName = `libro-diario-${diarioPeriod}.pdf`;

            pdfElement = (
              <Document>
                <PdfPage size="A4" style={baseStyles.page}>
                  <PdfHeader
                    tenantName={header.tenantName}
                    tenantNit={header.tenantNit}
                    tenantAddress={header.tenantAddress}
                    reportHeaderText={header.reportHeaderText}
                    logoUrl={header.logoUrl || undefined}
                    docTitle="LIBRO DIARIO"
                    docSubtitle={fmtPeriod(data.period)}
                  />
                  {data.entries.map((entry) => (
                    <View key={entry.entryNumber} wrap={false} style={{ marginBottom: 10 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                        <PdfText style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>
                          Asiento #{entry.entryNumber}
                        </PdfText>
                        <PdfText style={{ fontSize: 8, color: PDF_COLORS.muted }}>
                          {fmtDate(entry.date)} - {entry.description}
                        </PdfText>
                      </View>
                      <View style={baseStyles.table}>
                        <View style={baseStyles.tableHeaderRow}>
                          <PdfText style={[baseStyles.th, { width: "15%" }]}>Codigo</PdfText>
                          <PdfText style={[baseStyles.th, { width: "40%" }]}>Cuenta</PdfText>
                          <PdfText style={[baseStyles.thRight, { width: "22.5%" }]}>Debito</PdfText>
                          <PdfText style={[baseStyles.thRight, { width: "22.5%" }]}>Credito</PdfText>
                        </View>
                        {entry.lines.map((line, li) => (
                          <View
                            key={li}
                            style={li === entry.lines.length - 1 ? baseStyles.tableRowLast : baseStyles.tableRow}
                          >
                            <PdfText style={[baseStyles.td, { width: "15%" }]}>{line.accountCode}</PdfText>
                            <PdfText style={[baseStyles.td, { width: "40%" }]}>{line.accountName}</PdfText>
                            <PdfText style={[baseStyles.tdRight, { width: "22.5%" }]}>
                              {line.debit > 0 ? fmtCOP(line.debit) : "--"}
                            </PdfText>
                            <PdfText style={[baseStyles.tdRight, { width: "22.5%" }]}>
                              {line.credit > 0 ? fmtCOP(line.credit) : "--"}
                            </PdfText>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                  <View style={baseStyles.divider} />
                  <View style={baseStyles.balanceRow}>
                    <View style={baseStyles.balanceCard}>
                      <PdfText style={baseStyles.balanceLabel}>Total Debitos</PdfText>
                      <PdfText style={baseStyles.balanceValue}>{fmtCOP(data.totalDebit)}</PdfText>
                    </View>
                    <View style={baseStyles.balanceCard}>
                      <PdfText style={baseStyles.balanceLabel}>Total Creditos</PdfText>
                      <PdfText style={baseStyles.balanceValue}>{fmtCOP(data.totalCredit)}</PdfText>
                    </View>
                  </View>
                  <PdfText style={baseStyles.note}>
                    {data.entries.length} asientos contables en el periodo. Cifras en COP.
                  </PdfText>
                  <PdfFooter
                    generatedDate={fmtDate(today())}
                    adminName={header.adminName}
                  />
                </PdfPage>
              </Document>
            );
            break;
          }

          // 4. Fondo de Reserva
          case "reserve-fund": {
            const { generateFondoReserva } = await import(
              "@/lib/reports/certifications"
            );
            const { data, error: err } = await generateFondoReserva();
            if (err || !data)
              throw new Error(err ?? "Fondo de reserva no configurado");
            const { default: Pdf } = await import(
              "@/components/pdf/reserve-fund-pdf"
            );
            title = "Fondo de Reserva";
            fileName = `fondo-reserva-${today()}.pdf`;
            pdfElement = <Pdf data={data} header={header} />;
            break;
          }

          // 5. Estado de Resultados
          case "income-statement": {
            const { generateIncomeStatement } = await import(
              "@/lib/reports/income-statement"
            );
            const { data, error: err } = await generateIncomeStatement(incomePeriod);
            if (err || !data) throw new Error(err ?? "Sin datos para este periodo");
            const { default: Pdf } = await import(
              "@/components/pdf/income-statement-pdf"
            );
            title = "Estado de Resultados";
            fileName = `estado-resultados-${incomePeriod}.pdf`;
            pdfElement = <Pdf data={data} header={header} />;
            break;
          }

          // 6. Balance de Comprobacion
          case "trial-balance": {
            const { generateTrialBalance } = await import(
              "@/lib/reports/trial-balance"
            );
            const { data, error: err } = await generateTrialBalance(trialPeriod);
            if (err || !data) throw new Error(err ?? "Sin datos para este periodo");
            const { default: Pdf } = await import(
              "@/components/pdf/trial-balance-pdf"
            );
            title = "Balance de Comprobacion";
            fileName = `balance-comprobacion-${trialPeriod}.pdf`;
            pdfElement = <Pdf data={data} header={header} />;
            break;
          }

          // 7. Ejecucion Presupuestal
          case "budget-execution": {
            const { generateBudgetExecutionReport } = await import(
              "@/lib/reports/budget-execution-report"
            );
            const { data, error: err } =
              await generateBudgetExecutionReport(execMonth);
            if (err || !data) throw new Error(err ?? "Sin datos de ejecucion");
            const { default: Pdf } = await import(
              "@/components/pdf/budget-execution-pdf"
            );
            title = "Ejecucion Presupuestal";
            fileName = `ejecucion-presupuestal-mes-${execMonth}.pdf`;
            pdfElement = <Pdf data={data} header={header} />;
            break;
          }

          // 8. Cartera por Edades
          case "aging-report": {
            const { generateAgingReport } = await import(
              "@/lib/reports/aging-report"
            );
            const { data, error: err } = await generateAgingReport();
            if (err || !data) throw new Error(err ?? "Sin datos de cartera");
            const { default: Pdf } = await import(
              "@/components/pdf/aging-report-pdf"
            );
            title = "Cartera por Edades";
            fileName = `cartera-edades-${today()}.pdf`;
            pdfElement = <Pdf data={data} header={header} />;
            break;
          }

          default:
            throw new Error("Reporte no implementado");
        }

        if (pdfElement) {
          setPreview({ title, pdfDocument: pdfElement, fileName });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error generando reporte");
      } finally {
        setLoading(null);
      }
    },
    [
      header,
      statementUnit,
      pazUnit,
      diarioPeriod,
      incomePeriod,
      trialPeriod,
      execMonth,
    ]
  );

  usePageTransition(containerRef);

  // -- Render ----------------------------------------------------------------

  return (
    <>
      <style jsx global>{`
        @keyframes reportCardIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div ref={containerRef} className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="anim-header space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/5">
              <FileBarChart className="h-5 w-5 text-foreground/70" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Centro de Reportes
              </h1>
              <p className="text-xs text-muted-foreground">
                Genera, previsualiza y exporta reportes profesionales en PDF
              </p>
            </div>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Section: Contabilidad */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
            Contabilidad
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Estado de Resultados */}
            <ReportCard
              icon={TrendingUp}
              title="Estado de Resultados"
              description="Ingresos vs gastos del periodo. Muestra el excedente o deficit operacional."
              iconClassName="bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
              loading={loading === "income-statement"}
              onGenerate={() => generate("income-statement")}
              index={0}
            >
              <select
                className={selectClass}
                value={incomePeriod}
                onChange={(e) => setIncomePeriod(e.target.value)}
              >
                {periods.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </ReportCard>

            {/* Balance de Comprobacion */}
            <ReportCard
              icon={Scale}
              title="Balance de Comprobacion"
              description="Sumas y saldos de todas las cuentas. Verifica cuadratura contable del periodo."
              iconClassName="bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
              loading={loading === "trial-balance"}
              onGenerate={() => generate("trial-balance")}
              index={1}
            >
              <select
                className={selectClass}
                value={trialPeriod}
                onChange={(e) => setTrialPeriod(e.target.value)}
              >
                {periods.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </ReportCard>

            {/* Libro Diario */}
            <ReportCard
              icon={BookOpen}
              title="Libro Diario"
              description="Detalle de asientos contables confirmados en el periodo seleccionado."
              iconClassName="bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400"
              loading={loading === "libro-diario"}
              onGenerate={() => generate("libro-diario")}
              index={2}
            >
              <select
                className={selectClass}
                value={diarioPeriod}
                onChange={(e) => setDiarioPeriod(e.target.value)}
              >
                {periods.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </ReportCard>
          </div>
        </div>

        {/* Section: Presupuesto y Cartera */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
            Presupuesto y Cartera
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Ejecucion Presupuestal */}
            <ReportCard
              icon={BarChart3}
              title="Ejecucion Presupuestal"
              description="Comparacion presupuestado vs ejecutado por rubro con semaforos de alerta."
              iconClassName="bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
              loading={loading === "budget-execution"}
              onGenerate={() => generate("budget-execution")}
              index={3}
            >
              <select
                className={selectClass}
                value={execMonth}
                onChange={(e) => setExecMonth(Number(e.target.value))}
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value}>
                    Corte {m.label}
                  </option>
                ))}
              </select>
            </ReportCard>

            {/* Cartera por Edades */}
            <ReportCard
              icon={Clock}
              title="Cartera por Edades"
              description="Clasificacion de deuda por antiguedad con provision estimada y detalle por unidad."
              iconClassName="bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400"
              loading={loading === "aging-report"}
              onGenerate={() => generate("aging-report")}
              index={4}
            />

            {/* Fondo de Reserva */}
            <ReportCard
              icon={Shield}
              title="Fondo de Reserva"
              description="Estado del fondo segun Art. 35 Ley 675 con movimientos recientes."
              iconClassName="bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400"
              loading={loading === "reserve-fund"}
              onGenerate={() => generate("reserve-fund")}
              index={5}
            />
          </div>
        </div>

        {/* Section: Copropietarios */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/70">
            Copropietarios
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Estado de Cuenta */}
            <ReportCard
              icon={FileText}
              title="Estado de Cuenta"
              description="Detalle de cobros, pagos, saldos y antiguedad de cartera por unidad."
              iconClassName="bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400"
              loading={loading === "account-statement"}
              onGenerate={() => generate("account-statement")}
              disabled={!statementUnit}
              index={6}
            >
              <select
                className={selectClass}
                value={statementUnit}
                onChange={(e) => setStatementUnit(e.target.value)}
              >
                {units.length === 0 && (
                  <option value="">Sin unidades</option>
                )}
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    Unidad {u.number}
                  </option>
                ))}
              </select>
            </ReportCard>

            {/* Paz y Salvo */}
            <ReportCard
              icon={ShieldCheck}
              title="Paz y Salvo"
              description="Certificacion de estar al dia en obligaciones. Incluye firma del administrador."
              iconClassName="bg-lime-50 text-lime-600 dark:bg-lime-950 dark:text-lime-400"
              loading={loading === "paz-y-salvo"}
              onGenerate={() => generate("paz-y-salvo")}
              disabled={!pazUnit}
              index={7}
            >
              <select
                className={selectClass}
                value={pazUnit}
                onChange={(e) => setPazUnit(e.target.value)}
              >
                {units.length === 0 && (
                  <option value="">Sin unidades</option>
                )}
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    Unidad {u.number}
                  </option>
                ))}
              </select>
            </ReportCard>
          </div>
        </div>
      </div>

      {/* Preview dialog */}
      <ReportPreviewDialog
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.title ?? ""}
        pdfDocument={preview?.pdfDocument ?? null}
        fileName={preview?.fileName ?? "reporte.pdf"}
      />
    </>
  );
}
