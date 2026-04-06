"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePageTransition } from "@/hooks/use-page-transition";
import {
  calculateHealthIndicators,
  getHealthSummary,
} from "@/lib/indicators/health";
import {
  calculateProvision,
  getSuggestedActions,
} from "@/lib/indicators/provision";
import { formatCOP } from "@/lib/utils/format";
import type {
  HealthIndicator,
  HealthIndicatorLevel,
  AgingEntry,
} from "@/types/database";
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
  Activity,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
} from "lucide-react";

// -- Constants ---------------------------------------------------------------

const LEVEL_DOT: Record<HealthIndicatorLevel, string> = {
  green: "bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,.35)]",
  yellow: "bg-amber-400 shadow-[0_0_6px_1px_rgba(251,191,36,.3)]",
  red: "bg-red-400 shadow-[0_0_6px_1px_rgba(248,113,113,.35)]",
};

const LEVEL_VALUE_COLOR: Record<HealthIndicatorLevel, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  yellow: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
};

const LEVEL_BANNER: Record<
  HealthIndicatorLevel,
  { border: string; bg: string; label: string }
> = {
  green: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-500/5",
    label: "Buena",
  },
  yellow: {
    border: "border-l-amber-500",
    bg: "bg-amber-500/5",
    label: "Regular",
  },
  red: {
    border: "border-l-red-500",
    bg: "bg-red-500/5",
    label: "Critica",
  },
};

const AGING_ROW_BG: Record<string, string> = {
  current: "",
  "30": "bg-amber-500/[0.03]",
  "60": "bg-orange-500/[0.04]",
  "90": "bg-red-500/[0.04]",
  "180": "bg-red-500/[0.06]",
  over_180: "bg-red-500/[0.08]",
};

// -- Types -------------------------------------------------------------------

interface ProvisionData {
  aging: AgingEntry[];
  totalOutstanding: number;
  totalProvision: number;
  provisionPct: number;
  previousProvision: number | null;
}

interface ActionEntry {
  bucket: string;
  label: string;
  provisionPct: number;
  action: string;
}

// -- Page --------------------------------------------------------------------

export default function IndicatorsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [indicators, setIndicators] = useState<HealthIndicator[]>([]);
  const [summary, setSummary] = useState<{
    level: HealthIndicatorLevel;
    narrative: string;
  }>({ level: "green", narrative: "" });

  const [provision, setProvision] = useState<ProvisionData>({
    aging: [],
    totalOutstanding: 0,
    totalProvision: 0,
    provisionPct: 0,
    previousProvision: null,
  });
  const [actions, setActions] = useState<ActionEntry[]>([]);

  // -- Fetch -----------------------------------------------------------------

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [healthRes, provisionRes] = await Promise.all([
        calculateHealthIndicators(),
        calculateProvision(),
      ]);

      if (healthRes.error) throw new Error(healthRes.error);
      if (provisionRes.error) throw new Error(provisionRes.error);

      setIndicators(healthRes.indicators);
      setSummary(getHealthSummary(healthRes.indicators));

      setProvision({
        aging: provisionRes.aging,
        totalOutstanding: provisionRes.totalOutstanding,
        totalProvision: provisionRes.totalProvision,
        provisionPct: provisionRes.provisionPct,
        previousProvision: provisionRes.previousProvision,
      });

      setActions(getSuggestedActions());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // -- Helpers ---------------------------------------------------------------

  const getActionForBucket = (bucket: string): string => {
    return actions.find((a) => a.bucket === bucket)?.action ?? "--";
  };

  const provisionDelta =
    provision.previousProvision !== null
      ? provision.totalProvision - provision.previousProvision
      : null;

  usePageTransition(containerRef, { ready: !loading });

  // -- Render ----------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="anim-header flex items-end justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-xl tracking-tight">
              Indicadores de salud financiera
            </h2>
          </div>
          <p className="text-[13px] text-muted-foreground">
            6 KPIs clave con semaforo, provision de cartera y resumen narrativo
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
          Calculando indicadores...
        </div>
      ) : (
        <>
          {/* Health summary banner */}
          {indicators.length > 0 && (
            <div
              className={`anim-banner rounded-md border border-l-4 px-4 py-3 ${LEVEL_BANNER[summary.level].border} ${LEVEL_BANNER[summary.level].bg}`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${LEVEL_DOT[summary.level]}`}
                />
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Salud financiera:{" "}
                  <span className={LEVEL_VALUE_COLOR[summary.level]}>
                    {LEVEL_BANNER[summary.level].label}
                  </span>
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed">
                {summary.narrative}
              </p>
            </div>
          )}

          {/* 6 indicator cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {indicators.map((ind) => {
              const banner = LEVEL_BANNER[ind.level];
              return (
                <Card
                  key={ind.key}
                  className="anim-kpi relative overflow-hidden"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${LEVEL_DOT[ind.level]}`}
                      />
                      <p className="text-[13px] font-medium">{ind.name}</p>
                    </div>
                    <p
                      className={`mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight ${LEVEL_VALUE_COLOR[ind.level]}`}
                    >
                      {ind.formatted}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {ind.description}
                    </p>
                    {/* Subtle background accent */}
                    <div
                      className={`absolute -right-3 -top-3 h-16 w-16 rounded-full opacity-[0.06] ${
                        ind.level === "green"
                          ? "bg-emerald-500"
                          : ind.level === "yellow"
                            ? "bg-amber-500"
                            : "bg-red-500"
                      }`}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Provision section */}
          <div className="grid grid-cols-5 gap-4">
            {/* Provision table */}
            <Card className="anim-card col-span-3">
              <CardHeader className="border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <CardTitle className="font-display text-sm">
                      Provision de cartera por antiguedad
                    </CardTitle>
                    <CardDescription className="text-[11px]">
                      Porcentaje de provision aplicado segun dias de vencimiento
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4 text-[11px] font-medium uppercase tracking-wider">
                        Rango
                      </TableHead>
                      <TableHead className="w-14 text-center text-[11px] font-medium uppercase tracking-wider">
                        Cant.
                      </TableHead>
                      <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider">
                        Monto pendiente
                      </TableHead>
                      <TableHead className="w-16 text-center text-[11px] font-medium uppercase tracking-wider">
                        % Prov.
                      </TableHead>
                      <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider">
                        Monto provision
                      </TableHead>
                      <TableHead className="pr-4 text-right text-[11px] font-medium uppercase tracking-wider">
                        Accion sugerida
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {provision.aging.map((row) => (
                      <TableRow
                        key={row.bucket}
                        className={AGING_ROW_BG[row.bucket] ?? ""}
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
                        <TableCell className="text-center font-mono text-[12px] tabular-nums text-muted-foreground">
                          {row.provision_pct}%
                        </TableCell>
                        <TableCell className="text-right font-mono text-[13px] tabular-nums">
                          {formatCOP(row.provision_amount)}
                        </TableCell>
                        <TableCell className="pr-4 text-right text-[12px] text-muted-foreground">
                          {getActionForBucket(row.bucket)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Footer totals */}
                    <TableRow className="border-t-2 bg-muted/30 font-semibold hover:bg-muted/30">
                      <TableCell className="pl-4 text-[13px] font-semibold">
                        Total
                      </TableCell>
                      <TableCell className="text-center font-mono text-[13px] font-semibold tabular-nums">
                        {provision.aging.reduce((s, a) => s + a.count, 0)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[13px] font-semibold tabular-nums">
                        {formatCOP(provision.totalOutstanding)}
                      </TableCell>
                      <TableCell className="text-center font-mono text-[12px] font-semibold tabular-nums">
                        {provision.provisionPct}%
                      </TableCell>
                      <TableCell className="text-right font-mono text-[13px] font-semibold tabular-nums">
                        {formatCOP(provision.totalProvision)}
                      </TableCell>
                      <TableCell className="pr-4" />
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Provision summary */}
            <Card className="anim-card col-span-2">
              <CardHeader className="border-b px-4 py-3">
                <CardTitle className="font-display text-sm">
                  Resumen de provision
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Monto total provisionado sobre cartera pendiente
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 p-4">
                {/* Main provision amount */}
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    Provision total
                  </p>
                  <p className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight">
                    {formatCOP(provision.totalProvision)}
                  </p>
                </div>

                {/* Provision percentage */}
                <div className="flex items-baseline gap-3 border-t pt-4">
                  <div className="flex-1">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                      % sobre cartera
                    </p>
                    <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums tracking-tight">
                      {provision.provisionPct}%
                    </p>
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                      Cartera pendiente
                    </p>
                    <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight text-muted-foreground">
                      {formatCOP(provision.totalOutstanding)}
                    </p>
                  </div>
                </div>

                {/* Previous provision comparison */}
                {provision.previousProvision !== null && (
                  <div className="border-t pt-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                      Provision anterior
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-mono text-base tabular-nums text-muted-foreground">
                        {formatCOP(provision.previousProvision)}
                      </span>
                      {provisionDelta !== null && provisionDelta !== 0 && (
                        <Badge
                          variant="outline"
                          className={`gap-1 text-[10px] ${
                            provisionDelta > 0
                              ? "border-red-300/40 text-red-600 dark:text-red-400"
                              : "border-emerald-300/40 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {provisionDelta > 0 ? (
                            <TrendingUp className="h-2.5 w-2.5" />
                          ) : (
                            <TrendingDown className="h-2.5 w-2.5" />
                          )}
                          {provisionDelta > 0 ? "+" : ""}
                          {formatCOP(provisionDelta)}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
