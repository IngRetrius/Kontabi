"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { usePageTransition } from "@/hooks/use-page-transition";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  getUnitStatement,
  type UnitStatementResult,
} from "@/lib/accounting/account-statement";
import { createClient } from "@/lib/supabase/client";
import { formatCOP, formatPeriod, formatShortDate, formatCoefficient, formatDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  User,
  Building2,
  FileText,
  Download,
  CreditCard,
  AlertCircle,
  Loader2,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";

const PDFDownloadLink = dynamic(
  () => import("@react-pdf/renderer").then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);
const AccountStatementPdf = dynamic(
  () => import("@/components/pdf/account-statement-pdf"),
  { ssr: false }
);

// -- Aging palette -----------------------------------------------------------

const AGING_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  current:  { bg: "bg-muted/60",          text: "text-muted-foreground", bar: "bg-muted-foreground/30" },
  "30":     { bg: "bg-amber-500/10",      text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-400" },
  "60":     { bg: "bg-orange-500/10",      text: "text-orange-600 dark:text-orange-400", bar: "bg-orange-400" },
  "90":     { bg: "bg-red-500/10",         text: "text-red-600 dark:text-red-400", bar: "bg-red-400" },
  "180":    { bg: "bg-red-500/15",         text: "text-red-700 dark:text-red-300", bar: "bg-red-500" },
  over_180: { bg: "bg-destructive/10",     text: "text-destructive", bar: "bg-destructive" },
};

// -- Page --------------------------------------------------------------------

export default function UnitStatementPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const params = useParams<{ id: string }>();
  const unitId = params.id;

  const [data, setData] = useState<UnitStatementResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<{
    name: string;
    nit: string;
    address: string;
  } | null>(null);

  useEffect(() => {
    if (!unitId) return;
    async function load() {
      setLoading(true);
      const supabase = createClient();

      const [result, tenantRes] = await Promise.all([
        getUnitStatement(unitId),
        supabase
          .from("tenants")
          .select("name, nit, address")
          .limit(1)
          .single(),
      ]);

      if (result.error) {
        setError(result.error);
      } else {
        setData(result);
      }

      if (tenantRes.data) {
        setTenant(tenantRes.data);
      }

      setLoading(false);
    }
    load();
  }, [unitId]);

  usePageTransition(containerRef, { ready: !loading });

  // -- Loading ---------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando estado de cuenta...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2.5 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        {error ?? "No se encontro la unidad"}
      </div>
    );
  }

  // -- Derived ---------------------------------------------------------------

  const agingTotal = data.aging.reduce((s, a) => s + a.amount, 0);
  const provisionTotal = data.aging.reduce((s, a) => s + a.provision_amount, 0);
  const balanceIsDebt = data.currentBalance > 0;

  // -- Render ----------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="anim-header flex items-start justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-xl tracking-tight">
              Estado de cuenta
            </h2>
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Historial completo de cobros y pagos de la unidad.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data && tenant && (
            <PDFDownloadLink
              document={
                <AccountStatementPdf
                  data={data}
                  tenantName={tenant.name}
                  tenantNit={tenant.nit}
                  tenantAddress={tenant.address}
                  generatedDate={formatDate(new Date())}
                  adminName="Administrador"
                />
              }
              fileName={`estado-cuenta-${data.unitNumber}.pdf`}
            >
              {({ loading: pdfLoading }) => (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={pdfLoading}
                >
                  {pdfLoading ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="mr-1.5 h-3 w-3" />
                  )}
                  Descargar PDF
                </Button>
              )}
            </PDFDownloadLink>
          )}
          {(!data || !tenant) && (
            <Button variant="outline" size="sm" className="h-8 text-xs" disabled>
              <Download className="mr-1.5 h-3 w-3" />
              Descargar PDF
            </Button>
          )}
          <Link href="/dashboard/payments/register">
            <Button size="sm" className="h-8 text-xs">
              <CreditCard className="mr-1.5 h-3 w-3" />
              Registrar pago
            </Button>
          </Link>
        </div>
      </div>

      {/* Unit info strip */}
      <Card className="anim-card">
        <CardContent className="flex items-center gap-6 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/[0.07]">
            <Building2 className="h-4 w-4 text-primary/70" />
          </div>
          <div className="grid flex-1 grid-cols-4 gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Unidad
              </p>
              <p className="text-[15px] font-semibold tracking-tight">
                {data.unitNumber}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Torre
              </p>
              <p className="text-[13px] font-medium">
                {data.tower ?? "\u2014"}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Propietario
              </p>
              <div className="flex items-center gap-1.5">
                {data.ownerName && (
                  <User className="h-3 w-3 text-muted-foreground/50" />
                )}
                <p className="text-[13px] font-medium">
                  {data.ownerName ?? "\u2014"}
                </p>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Coeficiente
              </p>
              <p className="font-mono text-[13px] tabular-nums">
                {formatCoefficient(data.coefficient)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Balance summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Total cobrado
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40" />
              <p className="font-mono text-lg font-semibold tabular-nums tracking-tight">
                {formatCOP(data.totalCharged)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Total pagado
            </p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400/70" />
              <p className="font-mono text-lg font-semibold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatCOP(data.totalPaid)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Saldo actual
            </p>
            <p
              className={`mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight ${
                balanceIsDebt
                  ? "text-red-500"
                  : data.currentBalance < 0
                    ? "text-emerald-500"
                    : "text-muted-foreground"
              }`}
            >
              {balanceIsDebt ? "" : data.currentBalance < 0 ? "-" : ""}
              {formatCOP(Math.abs(data.currentBalance))}
            </p>
            {balanceIsDebt && (
              <p className="mt-0.5 text-[11px] text-red-500/70">
                Deuda pendiente
              </p>
            )}
            {data.currentBalance < 0 && (
              <p className="mt-0.5 text-[11px] text-emerald-500/70">
                Saldo a favor
              </p>
            )}
            {data.currentBalance === 0 && (
              <p className="mt-0.5 text-[11px] text-muted-foreground/50">
                Al dia
              </p>
            )}
          </CardContent>
          <div
            className={`absolute -right-3 -top-3 h-16 w-16 rounded-full ${
              balanceIsDebt
                ? "bg-red-500/[0.06]"
                : data.currentBalance < 0
                  ? "bg-emerald-500/[0.06]"
                  : "bg-muted/30"
            }`}
          />
        </Card>
      </div>

      {/* Aging breakdown */}
      {agingTotal > 0 && (
        <Card className="anim-card">
          <CardHeader className="border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-display text-sm">
                  Antiguedad de cartera
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Clasificacion del saldo pendiente por dias de vencimiento.
                </CardDescription>
              </div>
              {provisionTotal > 0 && (
                <div className="text-right">
                  <p className="text-[11px] text-muted-foreground/70">
                    Provision estimada
                  </p>
                  <p className="font-mono text-[13px] font-semibold tabular-nums text-amber-500">
                    {formatCOP(provisionTotal)}
                  </p>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {/* Stacked bar */}
            <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-muted/40">
              {data.aging
                .filter((a) => a.amount > 0)
                .map((a) => {
                  const pct = (a.amount / agingTotal) * 100;
                  const colors = AGING_COLORS[a.bucket] ?? AGING_COLORS.current;
                  return (
                    <div
                      key={a.bucket}
                      className={`${colors.bar} transition-all`}
                      style={{ width: `${pct}%` }}
                      title={`${a.label}: ${formatCOP(a.amount)}`}
                    />
                  );
                })}
            </div>

            {/* Legend */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {data.aging.map((a) => {
                const colors = AGING_COLORS[a.bucket] ?? AGING_COLORS.current;
                return (
                  <div
                    key={a.bucket}
                    className={`rounded-md px-2.5 py-2 ${colors.bg}`}
                  >
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                      {a.label}
                    </p>
                    <p
                      className={`font-mono text-[13px] font-semibold tabular-nums ${
                        a.amount > 0 ? colors.text : "text-muted-foreground/40"
                      }`}
                    >
                      {formatCOP(a.amount)}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50">
                      {a.count} cobro(s)
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statement table */}
      <Card className="anim-table">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="font-display text-sm">
            Movimientos
          </CardTitle>
          <CardDescription className="text-[11px]">
            Historial cronologico de cobros y pagos aplicados.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.lines.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-12 text-center">
              <FileText className="h-5 w-5 text-muted-foreground/30" />
              <p className="text-[13px] font-medium text-muted-foreground">
                Sin movimientos registrados
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-24 pl-4 text-[11px] font-medium uppercase tracking-wider">
                      Fecha
                    </TableHead>
                    <TableHead className="w-28 text-[11px] font-medium uppercase tracking-wider">
                      Periodo
                    </TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                      Concepto
                    </TableHead>
                    <TableHead className="w-32 text-right text-[11px] font-medium uppercase tracking-wider">
                      Cargo
                    </TableHead>
                    <TableHead className="w-32 text-right text-[11px] font-medium uppercase tracking-wider">
                      Abono
                    </TableHead>
                    <TableHead className="w-32 text-right pr-4 text-[11px] font-medium uppercase tracking-wider">
                      Saldo
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.lines.map((line, idx) => {
                    const isCharge = line.charge > 0;
                    return (
                      <TableRow key={idx}>
                        <TableCell className="pl-4 font-mono text-[12px] tabular-nums text-muted-foreground">
                          {formatShortDate(new Date(line.date))}
                        </TableCell>
                        <TableCell className="text-[13px]">
                          {formatPeriod(line.period)}
                        </TableCell>
                        <TableCell className="text-[13px]">
                          <div className="flex items-center gap-1.5">
                            {isCharge ? (
                              <ArrowUpRight className="h-3 w-3 text-muted-foreground/40" />
                            ) : (
                              <ArrowDownLeft className="h-3 w-3 text-emerald-400/70" />
                            )}
                            <span className={isCharge ? "" : "text-emerald-600 dark:text-emerald-400"}>
                              {line.concept}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-[13px] tabular-nums">
                          {line.charge > 0 ? (
                            <span className="text-muted-foreground">
                              {formatCOP(line.charge)}
                            </span>
                          ) : (
                            "\u2014"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[13px] tabular-nums">
                          {line.payment > 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {formatCOP(line.payment)}
                            </span>
                          ) : (
                            "\u2014"
                          )}
                        </TableCell>
                        <TableCell
                          className={`pr-4 text-right font-mono text-[13px] font-semibold tabular-nums ${
                            line.balance > 0
                              ? "text-red-500"
                              : line.balance < 0
                                ? "text-emerald-500"
                                : "text-muted-foreground"
                          }`}
                        >
                          {formatCOP(Math.abs(line.balance))}
                          {line.balance < 0 && (
                            <span className="ml-0.5 text-[10px] font-normal">
                              CF
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
