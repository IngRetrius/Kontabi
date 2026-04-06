"use client";

import { useState, useEffect, useCallback, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePageTransition } from "@/hooks/use-page-transition";
import { createClient } from "@/lib/supabase/client";
import type { Budget, BudgetItem } from "@/types/database";
import {
  calculateExecution,
  type BudgetExecution,
  type BudgetExecutionItem,
} from "@/lib/accounting/budget-execution";
import { formatCOP } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  CheckCircle2,
  Zap,
  AlertCircle,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  FileSpreadsheet,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// -- Status ------------------------------------------------------------------

const STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline"; dotClass: string }
> = {
  draft: { label: "Borrador", variant: "outline", dotClass: "bg-muted-foreground/50" },
  approved: { label: "Aprobado", variant: "secondary", dotClass: "bg-sky-400" },
  active: { label: "Vigente", variant: "default", dotClass: "bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,.35)]" },
};

const CATEGORY_LABELS: Record<string, string> = {
  payroll: "Nomina",
  security: "Vigilancia",
  cleaning: "Aseo",
  maintenance: "Mantenimiento",
  utilities: "Servicios",
  insurance: "Seguros",
  admin: "Admin",
  legal: "Legal",
  reserve_fund: "Reserva",
  other: "Otros",
};

const SEMAPHORE_DOT: Record<string, string> = {
  green: "bg-emerald-400",
  yellow: "bg-amber-400 shadow-[0_0_4px_1px_rgba(251,191,36,.3)]",
  red: "bg-red-400 shadow-[0_0_4px_1px_rgba(248,113,113,.35)]",
};

// -- Page --------------------------------------------------------------------

export default function BudgetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { id } = use(params);
  const router = useRouter();

  const [budget, setBudget] = useState<Budget | null>(null);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [execution, setExecution] = useState<BudgetExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [execLoading, setExecLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -- Fetch budget + items --------------------------------------------------

  const fetchBudget = useCallback(async () => {
    const supabase = createClient();

    const [budgetRes, itemsRes] = await Promise.all([
      supabase.from("budgets").select("*").eq("id", id).single(),
      supabase
        .from("budget_items")
        .select("*")
        .eq("budget_id", id)
        .order("sort_order"),
    ]);

    return {
      budget: budgetRes.error ? null : (budgetRes.data as Budget),
      items: (itemsRes.data ?? []) as BudgetItem[],
      error: budgetRes.error?.message ?? null,
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    void fetchBudget().then((result) => {
      if (cancelled) return;
      setBudget(result.budget);
      setItems(result.items);
      setError(result.error);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [fetchBudget]);

  // -- Fetch execution -------------------------------------------------------

  const fetchExecution = useCallback(async () => {
    if (!budget) return;
    setExecLoading(true);
    const { execution: exec, error: err } = await calculateExecution(id);
    if (err) setError(err);
    else setExecution(exec);
    setExecLoading(false);
  }, [id, budget]);

  // -- Actions ---------------------------------------------------------------

  const handleApprove = async () => {
    const supabase = createClient();
    const { error: err } = await supabase
      .from("budgets")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", id);
    if (err) setError(err.message);
    else await fetchBudget();
  };

  const handleActivate = async () => {
    const supabase = createClient();
    const { error: err } = await supabase
      .from("budgets")
      .update({ status: "active" })
      .eq("id", id);
    if (err) setError(err.message);
    else await fetchBudget();
  };

  // -- Derived ---------------------------------------------------------------

  const st = budget ? STATUS_MAP[budget.status] : null;
  const monthlyTotal = budget ? Math.round(budget.total / 12) : 0;
  const reserveAmount = budget
    ? Math.round(budget.total * (budget.reserve_fund_pct / 100))
    : 0;

  // Chart data
  const chartData = execution?.items
    .filter((i) => i.budgetedAccumulated > 0 || i.executedAccumulated > 0)
    .map((i) => ({
      name: i.itemName.length > 18 ? i.itemName.slice(0, 16) + "..." : i.itemName,
      Presupuestado: i.budgetedAccumulated,
      Ejecutado: i.executedAccumulated,
    })) ?? [];

  usePageTransition(containerRef, { ready: !loading });

  // -- Render ----------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-muted-foreground">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        Cargando presupuesto...
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <p className="text-[13px] text-muted-foreground">
          {error ?? "Presupuesto no encontrado"}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[12px]"
          onClick={() => router.push("/dashboard/budget/list")}
        >
          Volver al listado
        </Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-6">
      {/* ---- Header ---- */}
      <div className="anim-header flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="mt-0.5 h-7 w-7 shrink-0"
            onClick={() => router.push("/dashboard/budget/list")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="font-display text-xl tracking-tight">
                {budget.name}
              </h2>
              {st && (
                <Badge variant={st.variant} className="gap-1.5 text-[11px]">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${st.dotClass}`} />
                  {st.label}
                </Badge>
              )}
            </div>
            <p className="text-[13px] text-muted-foreground">
              Ano fiscal {budget.year}
              {budget.notes && <> &mdash; {budget.notes}</>}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {budget.status === "draft" && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={handleApprove}
            >
              <CheckCircle2 className="mr-1.5 h-3 w-3 text-sky-500" />
              Aprobar
            </Button>
          )}
          {budget.status === "approved" && (
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={handleActivate}
            >
              <Zap className="mr-1.5 h-3 w-3" />
              Activar como vigente
            </Button>
          )}
        </div>
      </div>

      {/* ---- KPI strip ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Total anual
            </p>
            <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums tracking-tight">
              {formatCOP(budget.total)}
            </p>
            <div className="absolute -right-2 -top-2 h-14 w-14 rounded-full bg-foreground/3" />
          </CardContent>
        </Card>
        <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Mensual
            </p>
            <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums tracking-tight">
              {formatCOP(monthlyTotal)}
            </p>
          </CardContent>
        </Card>
        <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Fondo reserva ({budget.reserve_fund_pct}%)
            </p>
            <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums tracking-tight">
              {formatCOP(reserveAmount)}
            </p>
          </CardContent>
        </Card>
        <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Rubros
            </p>
            <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums tracking-tight">
              {items.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="anim-banner flex items-center gap-2.5 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* ---- Tabs ---- */}
      <Tabs defaultValue="detail" className="anim-card">
        <TabsList variant="line" className="border-b border-border pb-0">
          <TabsTrigger value="detail" className="gap-1.5 text-[13px]">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Detalle
          </TabsTrigger>
          <TabsTrigger
            value="execution"
            className="gap-1.5 text-[13px]"
            onClick={() => {
              if (!execution && !execLoading) fetchExecution();
            }}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Ejecucion
          </TabsTrigger>
        </TabsList>

        {/* ---- TAB: Detail ---- */}
        <TabsContent value="detail" className="pt-4">
          <Card>
            <CardHeader className="border-b px-4 py-3">
              <CardTitle className="font-display text-sm">
                Rubros del presupuesto
              </CardTitle>
              <CardDescription className="text-[11px]">
                {items.length} rubros registrados. Monto mensual x 12 = anual.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {items.length === 0 ? (
                <div className="py-12 text-center text-[13px] text-muted-foreground">
                  Sin rubros registrados
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-8 pl-4 text-[11px] font-medium uppercase tracking-wider">
                          #
                        </TableHead>
                        <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                          Rubro
                        </TableHead>
                        <TableHead className="w-28 text-[11px] font-medium uppercase tracking-wider">
                          Categoria
                        </TableHead>
                        <TableHead className="w-32 text-right text-[11px] font-medium uppercase tracking-wider">
                          Mensual
                        </TableHead>
                        <TableHead className="w-32 text-right text-[11px] font-medium uppercase tracking-wider">
                          Anual
                        </TableHead>
                        <TableHead className="w-20 text-right pr-4 text-[11px] font-medium uppercase tracking-wider">
                          % Total
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, idx) => {
                        const pctOfTotal =
                          budget.total > 0
                            ? ((item.annual_amount / budget.total) * 100).toFixed(1)
                            : "0.0";
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="pl-4 font-mono text-[11px] text-muted-foreground/50">
                              {String(idx + 1).padStart(2, "0")}
                            </TableCell>
                            <TableCell className="text-[13px] font-medium">
                              {item.name}
                            </TableCell>
                            <TableCell>
                              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                {CATEGORY_LABELS[item.category] ?? item.category}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-[13px] tabular-nums">
                              {formatCOP(item.monthly_amount)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[13px] tabular-nums">
                              {formatCOP(item.annual_amount)}
                            </TableCell>
                            <TableCell className="pr-4 text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                              {pctOfTotal}%
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Totals row */}
                      <TableRow className="border-t-2 border-border bg-muted/30 font-semibold hover:bg-muted/30">
                        <TableCell className="pl-4" />
                        <TableCell className="text-[13px]">Total</TableCell>
                        <TableCell />
                        <TableCell className="text-right font-mono text-[13px] tabular-nums">
                          {formatCOP(monthlyTotal)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[13px] tabular-nums">
                          {formatCOP(budget.total)}
                        </TableCell>
                        <TableCell className="pr-4 text-right font-mono text-[13px] tabular-nums">
                          100%
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- TAB: Execution ---- */}
        <TabsContent value="execution" className="space-y-4 pt-4">
          {execLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Calculando ejecucion presupuestal...
            </div>
          ) : !execution ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <BarChart3 className="h-5 w-5 text-muted-foreground/40" />
              <p className="text-[13px] text-muted-foreground">
                Haz clic en la pestana para cargar la ejecucion
              </p>
            </div>
          ) : (
            <>
              {/* Execution alerts */}
              {execution.overBudgetAlerts.length > 0 && (
                <div className="flex items-start gap-2.5 rounded-md border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-[13px]">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <div>
                    <p className="font-medium text-amber-600 dark:text-amber-400">
                      {execution.overBudgetAlerts.length} rubro(s) superan el
                      115% de ejecucion
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {execution.overBudgetAlerts
                        .map((a) => `${a.itemName} (${a.executionPct}%)`)
                        .join(", ")}
                    </p>
                  </div>
                </div>
              )}

              {/* Execution KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                      Presupuestado acumulado
                    </p>
                    <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight">
                      {formatCOP(execution.totalBudgeted)}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {execution.monthsElapsed} meses
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                      Ejecutado
                    </p>
                    <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight">
                      {formatCOP(execution.totalExecuted)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="relative overflow-hidden">
                  <CardContent className="p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                      % Ejecucion global
                    </p>
                    <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight">
                      {execution.totalExecutionPct}%
                    </p>
                    {/* Inline progress bar */}
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${
                          execution.totalExecutionPct > 115
                            ? "bg-red-400"
                            : execution.totalExecutionPct > 100
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                        }`}
                        style={{
                          width: `${Math.min(execution.totalExecutionPct, 100)}%`,
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Chart */}
              {chartData.length > 0 && (
                <Card>
                  <CardHeader className="border-b px-4 py-3">
                    <CardTitle className="font-display text-sm">
                      Presupuestado vs Ejecutado
                    </CardTitle>
                    <CardDescription className="text-[11px]">
                      Comparativo acumulado a {execution.monthsElapsed} meses
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="h-70">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={chartData}
                          margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
                          barCategoryGap="20%"
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="hsl(var(--border))"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                            axisLine={{ stroke: "hsl(var(--border))" }}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(v: number) =>
                              v >= 1_000_000
                                ? `${(v / 1_000_000).toFixed(1)}M`
                                : v >= 1_000
                                  ? `${(v / 1_000).toFixed(0)}K`
                                  : String(v)
                            }
                          />
                          <RechartsTooltip
                            contentStyle={{
                              fontSize: 12,
                              borderRadius: 6,
                              border: "1px solid hsl(var(--border))",
                              background: "hsl(var(--popover))",
                              color: "hsl(var(--popover-foreground))",
                            }}
                            formatter={(value) =>
                              typeof value === "number" ? formatCOP(value) : "-"
                            }
                          />
                          <Legend
                            wrapperStyle={{ fontSize: 11 }}
                            iconSize={8}
                          />
                          <Bar
                            dataKey="Presupuestado"
                            fill="hsl(var(--chart-1))"
                            radius={[3, 3, 0, 0]}
                          />
                          <Bar
                            dataKey="Ejecutado"
                            fill="hsl(var(--chart-3))"
                            radius={[3, 3, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Execution table */}
              <Card>
                <CardHeader className="border-b px-4 py-3">
                  <CardTitle className="font-display text-sm">
                    Detalle por rubro
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="pl-4 text-[11px] font-medium uppercase tracking-wider">
                            Rubro
                          </TableHead>
                          <TableHead className="w-24 text-[11px] font-medium uppercase tracking-wider">
                            Cuenta
                          </TableHead>
                          <TableHead className="w-32 text-right text-[11px] font-medium uppercase tracking-wider">
                            Presupuestado
                          </TableHead>
                          <TableHead className="w-32 text-right text-[11px] font-medium uppercase tracking-wider">
                            Ejecutado
                          </TableHead>
                          <TableHead className="w-32 text-right text-[11px] font-medium uppercase tracking-wider">
                            Variacion
                          </TableHead>
                          <TableHead className="w-20 text-right text-[11px] font-medium uppercase tracking-wider">
                            %
                          </TableHead>
                          <TableHead className="w-10 pr-4" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {execution.items.map((item: BudgetExecutionItem) => (
                          <TableRow
                            key={item.itemId}
                            className={
                              item.semaphore === "red"
                                ? "bg-red-500/4"
                                : item.semaphore === "yellow"
                                  ? "bg-amber-500/3"
                                  : ""
                            }
                          >
                            <TableCell className="pl-4 text-[13px] font-medium">
                              {item.itemName}
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-muted-foreground">
                              {item.accountCode ?? "--"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[13px] tabular-nums">
                              {formatCOP(item.budgetedAccumulated)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[13px] tabular-nums">
                              {formatCOP(item.executedAccumulated)}
                            </TableCell>
                            <TableCell
                              className={`text-right font-mono text-[13px] tabular-nums ${
                                item.variance > 0
                                  ? "text-red-500"
                                  : item.variance < 0
                                    ? "text-emerald-500"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {item.variance > 0 ? "+" : ""}
                              {formatCOP(item.variance)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[13px] tabular-nums">
                              {item.executionPct}%
                            </TableCell>
                            <TableCell className="pr-4">
                              <span
                                className={`inline-block h-2 w-2 rounded-full ${SEMAPHORE_DOT[item.semaphore]}`}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Totals */}
                        <TableRow className="border-t-2 border-border bg-muted/30 font-semibold hover:bg-muted/30">
                          <TableCell className="pl-4 text-[13px]">Total</TableCell>
                          <TableCell />
                          <TableCell className="text-right font-mono text-[13px] tabular-nums">
                            {formatCOP(execution.totalBudgeted)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-[13px] tabular-nums">
                            {formatCOP(execution.totalExecuted)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono text-[13px] tabular-nums ${
                              execution.totalVariance > 0
                                ? "text-red-500"
                                : "text-emerald-500"
                            }`}
                          >
                            {execution.totalVariance > 0 ? "+" : ""}
                            {formatCOP(execution.totalVariance)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-[13px] tabular-nums">
                            {execution.totalExecutionPct}%
                          </TableCell>
                          <TableCell className="pr-4" />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
