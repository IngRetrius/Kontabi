"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { usePageTransition } from "@/hooks/use-page-transition";
import {
  calculateHealthIndicators,
  getHealthSummary,
} from "@/lib/indicators/health";
import { formatCOP } from "@/lib/utils/format";
import type { HealthIndicator, HealthIndicatorLevel } from "@/types/database";
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
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  AlertCircle,
  Activity,
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  CreditCard,
  TrendingUp,
} from "lucide-react";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";

// -- Constants ---------------------------------------------------------------

const LEVEL_DOT: Record<HealthIndicatorLevel, string> = {
  green: "bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,.35)]",
  yellow: "bg-amber-400 shadow-[0_0_6px_1px_rgba(251,191,36,.3)]",
  red: "bg-red-400 shadow-[0_0_6px_1px_rgba(248,113,113,.35)]",
};

const LEVEL_TEXT: Record<HealthIndicatorLevel, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  yellow: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
};

const INCOME_TYPES = new Set([
  "quota_payment",
  "extraordinary_payment",
  "late_interest",
  "common_area_rental",
  "other_income",
  "reserve_fund_contribution",
]);

// -- Types -------------------------------------------------------------------

interface KpiData {
  bankBalance: number;
  pendingPortfolio: number;
  monthlyExpenses: number;
  collectionRate: number;
}

interface RecentTx {
  id: string;
  type: string;
  amount: number;
  date: string;
  description: string;
  summary: string | null;
}

// -- Page --------------------------------------------------------------------

export default function OverviewPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [kpi, setKpi] = useState<KpiData>({
    bankBalance: 0,
    pendingPortfolio: 0,
    monthlyExpenses: 0,
    collectionRate: 0,
  });
  const [indicators, setIndicators] = useState<HealthIndicator[]>([]);
  const [healthLevel, setHealthLevel] = useState<HealthIndicatorLevel>("green");
  const [transactions, setTransactions] = useState<RecentTx[]>([]);

  // -- Fetch -----------------------------------------------------------------

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
      const currentPeriod = `${currentYear}-${currentMonth}`;

      const [
        bankRes,
        invoicesRes,
        expenseRes,
        yearInvoicesRes,
        healthRes,
        txRes,
      ] = await Promise.all([
        // Bank balance: account 1110
        supabase
          .from("journal_entry_lines")
          .select("debit, credit, account:accounts!inner(code)")
          .eq("account.code", "1110"),

        // Pending portfolio
        supabase
          .from("invoices")
          .select("total, paid_amount")
          .in("status", ["pending", "partial", "overdue"]),

        // Monthly expenses: accounts starting with 5
        supabase
          .from("journal_entry_lines")
          .select(
            "debit, credit, account:accounts!inner(code), journal_entry:journal_entries!inner(date)"
          )
          .like("account.code", "5%")
          .gte("journal_entry.date", `${currentPeriod}-01`)
          .lte("journal_entry.date", `${currentPeriod}-31`),

        // Year invoices for collection rate
        supabase
          .from("invoices")
          .select("total, paid_amount")
          .gte("period", `${currentYear}-01`)
          .lte("period", `${currentYear}-12`),

        // Health indicators
        calculateHealthIndicators(),

        // Recent transactions
        supabase
          .from("transactions")
          .select("id, type, amount, date, description, narratives")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      // KPIs
      const bankLines = bankRes.data ?? [];
      const bankBalance = bankLines.reduce(
        (s, l) => s + Number(l.debit) - Number(l.credit),
        0
      );

      const pendingInvoices = invoicesRes.data ?? [];
      const pendingPortfolio = pendingInvoices.reduce(
        (s, i) => s + (Number(i.total) - Number(i.paid_amount)),
        0
      );

      const expenseLines = expenseRes.data ?? [];
      const monthlyExpenses = expenseLines.reduce(
        (s, l) => s + Number(l.debit) - Number(l.credit),
        0
      );

      const yearInvoices = yearInvoicesRes.data ?? [];
      const yearBilled = yearInvoices.reduce(
        (s, i) => s + Number(i.total),
        0
      );
      const yearCollected = yearInvoices.reduce(
        (s, i) => s + Number(i.paid_amount),
        0
      );
      const collectionRate =
        yearBilled > 0
          ? Math.round((yearCollected / yearBilled) * 1000) / 10
          : 0;

      setKpi({
        bankBalance,
        pendingPortfolio,
        monthlyExpenses,
        collectionRate,
      });

      // Health indicators
      if (!healthRes.error) {
        setIndicators(healthRes.indicators);
        const summary = getHealthSummary(healthRes.indicators);
        setHealthLevel(summary.level);
      }

      // Recent transactions
      const rawTx = txRes.data ?? [];
      setTransactions(
        rawTx.map((t) => ({
          id: t.id,
          type: t.type,
          amount: Number(t.amount),
          date: t.date,
          description: t.description,
          summary:
            (t.narratives as { summary?: string } | null)?.summary ?? null,
        }))
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  usePageTransition(containerRef, { ready: !loading });

  // -- Derived ---------------------------------------------------------------

  const rateColor =
    kpi.collectionRate >= 90
      ? "text-emerald-600 dark:text-emerald-400"
      : kpi.collectionRate >= 70
        ? "text-amber-600 dark:text-amber-400"
        : "text-red-600 dark:text-red-400";

  // -- Render ----------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="anim-header flex items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-[11px] font-medium text-foreground mb-2">
            Vista general
          </div>
          <h2 className="font-display text-xl tracking-tight">
            Panel general
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Resumen financiero de tu conjunto residencial
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

      {/* Onboarding checklist */}
      <OnboardingChecklist />

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
          Cargando resumen...
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-lg hover:ring-foreground/20">
              <CardContent className="p-4">
                <div className="w-9 h-9 rounded-lg bg-foreground flex items-center justify-center text-background">
                  <Wallet className="w-4 h-4" />
                </div>
                <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Saldo en bancos
                </p>
                <p className="mt-1 font-mono text-xl font-semibold tabular-nums tracking-tight">
                  {formatCOP(kpi.bankBalance)}
                </p>
                <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-foreground/[0.03] transition-transform duration-300 group-hover:scale-150" />
              </CardContent>
            </Card>
            <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-lg hover:ring-foreground/20">
              <CardContent className="p-4">
                <div className="w-9 h-9 rounded-lg bg-foreground flex items-center justify-center text-background">
                  <CreditCard className="w-4 h-4" />
                </div>
                <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Cartera pendiente
                </p>
                <p
                  className={`mt-1 font-mono text-xl font-semibold tabular-nums tracking-tight ${
                    kpi.pendingPortfolio > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : ""
                  }`}
                >
                  {formatCOP(kpi.pendingPortfolio)}
                </p>
                <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-foreground/[0.03] transition-transform duration-300 group-hover:scale-150" />
              </CardContent>
            </Card>
            <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-lg hover:ring-foreground/20">
              <CardContent className="p-4">
                <div className="w-9 h-9 rounded-lg bg-foreground flex items-center justify-center text-background">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
                <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Gastos del mes
                </p>
                <p className="mt-1 font-mono text-xl font-semibold tabular-nums tracking-tight">
                  {formatCOP(kpi.monthlyExpenses)}
                </p>
                <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-foreground/[0.03] transition-transform duration-300 group-hover:scale-150" />
              </CardContent>
            </Card>
            <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-lg hover:ring-foreground/20">
              <CardContent className="p-4">
                <div className="w-9 h-9 rounded-lg bg-foreground flex items-center justify-center text-background">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Tasa de recaudo
                </p>
                <p
                  className={`mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight ${rateColor}`}
                >
                  {kpi.collectionRate}%
                </p>
                <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-foreground/[0.03] transition-transform duration-300 group-hover:scale-150" />
              </CardContent>
            </Card>
          </div>

          {/* Health indicators strip */}
          {indicators.length > 0 && (
            <Card className="anim-card">
              <CardHeader className="border-b px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                    <CardTitle className="font-display text-sm">
                      Salud financiera
                    </CardTitle>
                  </div>
                  <Link
                    href="/dashboard/indicators"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
                  >
                    Ver detalle
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="px-4 py-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {indicators.map((ind) => (
                    <div
                      key={ind.key}
                      className="flex flex-col gap-1.5 rounded-xl border border-border/50 bg-background px-3 py-2.5 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${LEVEL_DOT[ind.level]}`}
                        />
                        <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                          {ind.name}
                        </p>
                      </div>
                      <p
                        className={`font-mono text-base font-semibold tabular-nums ${LEVEL_TEXT[ind.level]}`}
                      >
                        {ind.formatted}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent transactions */}
          <Card className="anim-table">
            <CardHeader className="border-b px-4 py-3">
              <CardTitle className="font-display text-sm">
                Ultimas transacciones
              </CardTitle>
              <CardDescription className="text-[11px]">
                Movimientos mas recientes registrados en el sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {transactions.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 py-12 text-center">
                  <p className="text-[13px] font-medium text-muted-foreground">
                    Sin transacciones registradas
                  </p>
                  <p className="text-[12px] text-muted-foreground/60">
                    Comienza registrando tu primer movimiento
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-24 pl-4 text-[11px] font-medium uppercase tracking-wider">
                        Fecha
                      </TableHead>
                      <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                        Descripcion
                      </TableHead>
                      <TableHead className="w-36 pr-4 text-right text-[11px] font-medium uppercase tracking-wider">
                        Monto
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => {
                      const isIncome = INCOME_TYPES.has(tx.type);
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="pl-4 font-mono text-[12px] tabular-nums text-muted-foreground">
                            {tx.date}
                          </TableCell>
                          <TableCell className="text-[13px]">
                            <div className="flex items-center gap-1.5">
                              {isIncome ? (
                                <ArrowDownLeft className="h-3 w-3 shrink-0 text-emerald-400/70" />
                              ) : (
                                <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                              )}
                              <span className="truncate">
                                {tx.summary ?? tx.description}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell
                            className={`pr-4 text-right font-mono text-[13px] font-semibold tabular-nums ${
                              isIncome
                                ? "text-emerald-600 dark:text-emerald-400"
                                : ""
                            }`}
                          >
                            {formatCOP(tx.amount)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
