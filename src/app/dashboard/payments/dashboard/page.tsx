"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePageTransition } from "@/hooks/use-page-transition";
import { createClient } from "@/lib/supabase/client";
import { getGlobalAging } from "@/lib/accounting/account-statement";
import { markOverdueInvoices } from "@/lib/accounting/late-interest";
import { formatCOP } from "@/lib/utils/format";
import type { AgingBucket, AgingEntry } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  BarChart3,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

// -- Constants ---------------------------------------------------------------

const BUCKET_BADGE: Record<
  AgingBucket,
  { label: string; className: string }
> = {
  current: { label: "Corriente", className: "border-border text-muted-foreground" },
  "30": { label: "31-60 dias", className: "border-amber-300/40 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400" },
  "60": { label: "61-90 dias", className: "border-orange-300/40 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400" },
  "90": { label: "91-180 dias", className: "border-red-300/40 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400" },
  "180": { label: "181-360 dias", className: "border-red-400/40 bg-red-100 text-red-800 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300" },
  over_180: { label: "> 360 dias", className: "border-red-500/40 bg-red-200/60 text-red-900 dark:border-red-500/50 dark:bg-red-500/20 dark:text-red-200" },
};

const AGING_ROW_BG: Record<AgingBucket, string> = {
  current: "",
  "30": "bg-amber-500/[0.03]",
  "60": "bg-orange-500/[0.04]",
  "90": "bg-red-500/[0.04]",
  "180": "bg-red-500/[0.06]",
  over_180: "bg-red-500/[0.08]",
};

const PIE_COLORS = ["#10b981", "#fbbf24", "#f87171"]; // emerald, amber, red

const MONTH_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

// -- Types -------------------------------------------------------------------

interface KpiData {
  totalBilled: number;
  totalCollected: number;
  collectionRate: number;
  outstanding: number;
  overdueCount: number;
}

interface PieSlice {
  name: string;
  value: number;
  color: string;
}

interface TrendPoint {
  period: string;
  label: string;
  billed: number;
  collected: number;
}

interface TopDebtor {
  unitId: string;
  unitNumber: string;
  balance: number;
  bucket: AgingBucket;
}

// -- Helpers -----------------------------------------------------------------

function sixMonthsAgoPeriod(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentYearStart(): string {
  return `${new Date().getFullYear()}-01`;
}

function periodLabel(period: string): string {
  const [, m] = period.split("-");
  return MONTH_NAMES[Number(m) - 1] ?? period;
}

function pct(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

// -- Page --------------------------------------------------------------------

export default function PortfolioDashboardPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kpi, setKpi] = useState<KpiData>({
    totalBilled: 0,
    totalCollected: 0,
    collectionRate: 0,
    outstanding: 0,
    overdueCount: 0,
  });
  const [pieData, setPieData] = useState<PieSlice[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [topDebtors, setTopDebtors] = useState<TopDebtor[]>([]);
  const [agingData, setAgingData] = useState<AgingEntry[]>([]);

  // -- Fetch -----------------------------------------------------------------

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Mark overdue invoices silently
      markOverdueInvoices().catch(() => {});

      // Parallel fetches
      const [invoicesRes, agingRes] = await Promise.all([
        supabase
          .from("invoices")
          .select("total, paid_amount, status, period")
          .gte("period", currentYearStart()),
        getGlobalAging(),
      ]);

      if (invoicesRes.error) throw new Error(invoicesRes.error.message);
      if (agingRes.error) throw new Error(agingRes.error);

      const invoices = invoicesRes.data ?? [];

      // -- KPIs
      const totalBilled = invoices.reduce((s, i) => s + Number(i.total), 0);
      const totalCollected = invoices.reduce((s, i) => s + Number(i.paid_amount), 0);
      const overdueCount = invoices.filter((i) => i.status === "overdue").length;
      const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

      setKpi({
        totalBilled,
        totalCollected,
        collectionRate: Math.round(collectionRate * 10) / 10,
        outstanding: totalBilled - totalCollected,
        overdueCount,
      });

      // -- Pie chart
      const paidTotal = invoices
        .filter((i) => i.status === "paid")
        .reduce((s, i) => s + Number(i.total), 0);
      const pendingTotal = invoices
        .filter((i) => i.status === "pending" || i.status === "partial")
        .reduce((s, i) => s + (Number(i.total) - Number(i.paid_amount)), 0);
      const overdueTotal = invoices
        .filter((i) => i.status === "overdue")
        .reduce((s, i) => s + (Number(i.total) - Number(i.paid_amount)), 0);

      setPieData([
        { name: "Pagado", value: paidTotal, color: PIE_COLORS[0] },
        { name: "Pendiente", value: pendingTotal, color: PIE_COLORS[1] },
        { name: "Vencido", value: overdueTotal, color: PIE_COLORS[2] },
      ]);

      // -- Trend (last 6 months)
      const sixAgo = sixMonthsAgoPeriod();
      const recentInvoices = invoices.filter((i) => i.period >= sixAgo);
      const periodMap = new Map<string, { billed: number; collected: number }>();

      for (const inv of recentInvoices) {
        const entry = periodMap.get(inv.period) ?? { billed: 0, collected: 0 };
        entry.billed += Number(inv.total);
        entry.collected += Number(inv.paid_amount);
        periodMap.set(inv.period, entry);
      }

      const trend = Array.from(periodMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, data]) => ({
          period,
          label: periodLabel(period),
          billed: Math.round(data.billed),
          collected: Math.round(data.collected),
        }));

      setTrendData(trend);

      // -- Aging + debtors
      setAgingData(agingRes.aging);
      setTopDebtors(agingRes.byUnit.slice(0, 10));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // -- Derived ---------------------------------------------------------------

  const agingTotal = agingData.reduce((s, a) => s + a.amount, 0);
  const provisionTotal = agingData.reduce((s, a) => s + a.provision_amount, 0);
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  const rateIcon = kpi.collectionRate >= 90
    ? <TrendingUp className="h-3 w-3 text-emerald-500" />
    : kpi.collectionRate >= 70
      ? <TrendingUp className="h-3 w-3 text-amber-500" />
      : <TrendingDown className="h-3 w-3 text-red-500" />;

  const rateColor = kpi.collectionRate >= 90
    ? "text-emerald-600 dark:text-emerald-400"
    : kpi.collectionRate >= 70
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  usePageTransition(containerRef, { ready: !loading });

  // -- Render ----------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="anim-header flex items-end justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-xl tracking-tight">
              Dashboard de cartera
            </h2>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Resumen de recaudo, antiguedad y estado de la cartera del conjunto
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2.5 text-xs text-muted-foreground"
          onClick={fetchAll}
          disabled={loading}
        >
          <RefreshCw
            className={`mr-1.5 h-3 w-3 ${loading ? "animate-spin" : ""}`}
          />
          Recargar
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Cargando dashboard...
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Total facturado
                </p>
                <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight">
                  {formatCOP(kpi.totalBilled)}
                </p>
                <div className="absolute -right-2 -top-2 h-14 w-14 rounded-full bg-foreground/[0.03]" />
              </CardContent>
            </Card>
            <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Total recaudado
                </p>
                <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
                  {formatCOP(kpi.totalCollected)}
                </p>
              </CardContent>
            </Card>
            <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5">
                  {rateIcon}
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    Tasa de recaudo
                  </p>
                </div>
                <p className={`mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight ${rateColor}`}>
                  {kpi.collectionRate}%
                </p>
              </CardContent>
            </Card>
            <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Pendiente por cobrar
                </p>
                <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight text-amber-600 dark:text-amber-400">
                  {formatCOP(kpi.outstanding)}
                </p>
              </CardContent>
            </Card>
            <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    Cuotas vencidas
                  </p>
                </div>
                <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight text-red-500">
                  {kpi.overdueCount}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Pie chart */}
            <Card className="anim-card">
              <CardHeader className="border-b px-4 py-3">
                <CardTitle className="font-display text-sm">
                  Composicion de cartera
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Distribucion del monto total facturado por estado
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 py-5">
                {pieTotal === 0 ? (
                  <div className="flex h-[200px] items-center justify-center text-[13px] text-muted-foreground">
                    Sin datos de facturacion
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((entry, i) => (
                            <Cell key={entry.name} fill={PIE_COLORS[i]} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value) => formatCOP(Number(value))}
                          contentStyle={{
                            fontSize: "12px",
                            borderRadius: "6px",
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--card))",
                            boxShadow: "0 2px 8px rgba(0,0,0,.08)",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex items-center gap-5">
                      {pieData.map((slice) => (
                        <div key={slice.name} className="flex items-center gap-2">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: slice.color }}
                          />
                          <div className="text-[11px]">
                            <span className="text-muted-foreground">
                              {slice.name}
                            </span>
                            <span className="ml-1.5 font-mono font-medium tabular-nums">
                              {formatCOP(slice.value)}
                            </span>
                            <span className="ml-1 text-muted-foreground/60">
                              ({pct(slice.value, pieTotal)})
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Line chart */}
            <Card className="anim-card">
              <CardHeader className="border-b px-4 py-3">
                <CardTitle className="font-display text-sm">
                  Tendencia de recaudo
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Facturado vs recaudado por mes (ultimos 6 meses)
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 py-5">
                {trendData.length === 0 ? (
                  <div className="flex h-[200px] items-center justify-center text-[13px] text-muted-foreground">
                    Sin datos de tendencia
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={trendData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="hsl(var(--border))"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v: number) =>
                            v >= 1000000
                              ? `${(v / 1000000).toFixed(1)}M`
                              : v >= 1000
                                ? `${(v / 1000).toFixed(0)}K`
                                : String(v)
                          }
                          width={50}
                        />
                        <RechartsTooltip
                          formatter={(value, name) => [
                            formatCOP(Number(value)),
                            name === "billed" ? "Facturado" : "Recaudado",
                          ]}
                          contentStyle={{
                            fontSize: "12px",
                            borderRadius: "6px",
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--card))",
                            boxShadow: "0 2px 8px rgba(0,0,0,.08)",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="billed"
                          stroke="hsl(var(--muted-foreground))"
                          strokeWidth={1.5}
                          strokeDasharray="4 3"
                          dot={false}
                          name="billed"
                        />
                        <Line
                          type="monotone"
                          dataKey="collected"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={{ r: 3, fill: "hsl(var(--primary))" }}
                          activeDot={{ r: 4 }}
                          name="collected"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <div className="flex items-center justify-center gap-5 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-0.5 w-4 rounded bg-muted-foreground" style={{ borderTop: "1.5px dashed" }} />
                        <span className="text-muted-foreground">Facturado</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block h-0.5 w-4 rounded bg-primary" />
                        <span className="text-muted-foreground">Recaudado</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bottom row: Top debtors + Aging */}
          <div className="grid grid-cols-2 gap-4">
            {/* Top 10 debtors */}
            <Card className="anim-table">
              <CardHeader className="border-b px-4 py-3">
                <CardTitle className="font-display text-sm">
                  Top 10 deudores
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Unidades con mayor saldo pendiente
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {topDebtors.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-12">
                    <p className="text-[13px] font-medium">Sin deudores</p>
                    <p className="text-[12px] text-muted-foreground">
                      Todas las unidades estan al dia
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-20 pl-4 text-[11px] font-medium uppercase tracking-wider">
                          Unidad
                        </TableHead>
                        <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider">
                          Saldo pendiente
                        </TableHead>
                        <TableHead className="w-32 pr-4 text-right text-[11px] font-medium uppercase tracking-wider">
                          Antiguedad
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topDebtors.map((d) => {
                        const badge = BUCKET_BADGE[d.bucket];
                        return (
                          <TableRow key={d.unitId}>
                            <TableCell className="pl-4 font-mono text-[13px] font-semibold tabular-nums">
                              {d.unitNumber}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[13px] font-semibold tabular-nums">
                              {formatCOP(d.balance)}
                            </TableCell>
                            <TableCell className="pr-4 text-right">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${badge.className}`}
                              >
                                {badge.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Aging table */}
            <Card className="anim-table">
              <CardHeader className="border-b px-4 py-3">
                <CardTitle className="font-display text-sm">
                  Antiguedad de cartera
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Clasificacion de saldos pendientes por dias de vencimiento
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4 text-[11px] font-medium uppercase tracking-wider">
                        Rango
                      </TableHead>
                      <TableHead className="w-16 text-center text-[11px] font-medium uppercase tracking-wider">
                        Cant.
                      </TableHead>
                      <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider">
                        Monto
                      </TableHead>
                      <TableHead className="w-16 text-right text-[11px] font-medium uppercase tracking-wider">
                        % Total
                      </TableHead>
                      <TableHead className="w-16 text-center text-[11px] font-medium uppercase tracking-wider">
                        Prov.
                      </TableHead>
                      <TableHead className="pr-4 text-right text-[11px] font-medium uppercase tracking-wider">
                        Monto prov.
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agingData.map((row) => (
                      <TableRow
                        key={row.bucket}
                        className={AGING_ROW_BG[row.bucket]}
                      >
                        <TableCell className="pl-4 text-[13px]">
                          {row.label}
                        </TableCell>
                        <TableCell className="text-center font-mono text-[13px] tabular-nums">
                          {row.count}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[13px] tabular-nums">
                          {formatCOP(row.amount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                          {pct(row.amount, agingTotal)}
                        </TableCell>
                        <TableCell className="text-center font-mono text-[12px] tabular-nums text-muted-foreground">
                          {row.provision_pct}%
                        </TableCell>
                        <TableCell className="pr-4 text-right font-mono text-[13px] tabular-nums">
                          {formatCOP(row.provision_amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Footer totals */}
                    <TableRow className="border-t-2 bg-muted/30 font-semibold hover:bg-muted/30">
                      <TableCell className="pl-4 text-[13px] font-semibold">
                        Total
                      </TableCell>
                      <TableCell className="text-center font-mono text-[13px] font-semibold tabular-nums">
                        {agingData.reduce((s, a) => s + a.count, 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[13px] font-semibold tabular-nums">
                        {formatCOP(agingTotal)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[12px] font-semibold tabular-nums">
                        100%
                      </TableCell>
                      <TableCell className="text-center font-mono text-[12px] font-semibold tabular-nums">
                        {agingTotal > 0
                          ? `${((provisionTotal / agingTotal) * 100).toFixed(1)}%`
                          : "0%"}
                      </TableCell>
                      <TableCell className="pr-4 text-right font-mono text-[13px] font-semibold tabular-nums">
                        {formatCOP(provisionTotal)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
