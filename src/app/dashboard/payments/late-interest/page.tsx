"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePageTransition } from "@/hooks/use-page-transition";
import {
  calculateLateInterest,
  applyLateInterest,
  type LateInterestRow,
  type LateInterestConfig,
} from "@/lib/accounting/late-interest";
import { formatCOP } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Percent,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Loader2,
  Info,
} from "lucide-react";

// -- Helpers -----------------------------------------------------------------

function formatPeriodShort(period: string): string {
  const [year, month] = period.split("-");
  const months = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];
  return `${months[Number(month) - 1]} ${year}`;
}

// -- Page --------------------------------------------------------------------

export default function LateInterestPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<LateInterestRow[]>([]);
  const [config, setConfig] = useState<LateInterestConfig>({
    rate: 0.015,
    gracePeriodDays: 5,
    compound: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Apply flow
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<{
    applied: number;
    total: number;
  } | null>(null);

  // -- Fetch -----------------------------------------------------------------

  const fetchInterest = useCallback(async () => {
    setLoading(true);
    setError(null);
    setApplyResult(null);

    const { rows: data, config: cfg, error: err } = await calculateLateInterest();

    if (err) {
      setError(err);
    } else {
      setRows(data);
      setConfig(cfg);
      setSelected(new Set(data.map((r) => r.invoiceId)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInterest();
  }, [fetchInterest]);

  // -- Selection -------------------------------------------------------------

  const toggleRow = (invoiceId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.invoiceId)));
    }
  };

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && selected.size < rows.length;

  // -- Selected data ---------------------------------------------------------

  const selectedRows = useMemo(
    () => rows.filter((r) => selected.has(r.invoiceId)),
    [rows, selected]
  );

  const selectedTotal = selectedRows.reduce((s, r) => s + r.interestAmount, 0);
  const selectedUnits = new Set(selectedRows.map((r) => r.unitId)).size;

  // -- KPIs ------------------------------------------------------------------

  const totalUnits = new Set(rows.map((r) => r.unitId)).size;
  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);
  const totalInterest = rows.reduce((s, r) => s + r.interestAmount, 0);
  const effectiveRate =
    totalOutstanding > 0
      ? Math.round((totalInterest / totalOutstanding) * 1000) / 10
      : 0;

  // -- Apply -----------------------------------------------------------------

  const handleApply = async () => {
    setApplying(true);
    setError(null);

    const { applied, total, error: err } = await applyLateInterest(selectedRows);

    if (err) {
      setError(err);
      setApplying(false);
      setConfirmOpen(false);
      return;
    }

    setApplyResult({ applied, total });
    setApplying(false);
    setConfirmOpen(false);
    await fetchInterest();
  };

  usePageTransition(containerRef, { ready: !loading });

  // -- Render ----------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="anim-header flex items-end justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-xl tracking-tight">
              Intereses de mora
            </h2>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Calculo y aplicacion de intereses sobre cuotas vencidas
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2.5 text-xs text-muted-foreground"
          onClick={fetchInterest}
          disabled={loading}
        >
          <RefreshCw
            className={`mr-1.5 h-3 w-3 ${loading ? "animate-spin" : ""}`}
          />
          Recalcular
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Success */}
      {applyResult && (
        <div className="flex items-center gap-2.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-[13px]">
          <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          <span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              Mora aplicada correctamente.
            </span>{" "}
            {applyResult.applied} cobros actualizados por un total de{" "}
            <span className="font-mono font-semibold tabular-nums">
              {formatCOP(applyResult.total)}
            </span>
          </span>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Calculando intereses...
        </div>
      ) : (
        <>
          {/* Config banner */}
          <div className="anim-banner flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-4 py-2.5">
            <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
            <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
              <span>
                Tasa mensual:{" "}
                <span className="font-mono font-medium tabular-nums text-foreground">
                  {(config.rate * 100).toFixed(2)}%
                </span>
              </span>
              <span className="text-border">|</span>
              <span>
                Periodo de gracia:{" "}
                <span className="font-mono font-medium tabular-nums text-foreground">
                  {config.gracePeriodDays} dias
                </span>
              </span>
              <span className="text-border">|</span>
              <span>
                Tipo:{" "}
                <span className="font-medium text-foreground">
                  {config.compound ? "Compuesto" : "Simple"}
                </span>
              </span>
            </div>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Unidades con mora
                </p>
                <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight">
                  {totalUnits}
                </p>
                <div className="absolute -right-2 -top-2 h-14 w-14 rounded-full bg-foreground/[0.03]" />
              </CardContent>
            </Card>
            <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Capital adeudado
                </p>
                <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight text-red-600 dark:text-red-400">
                  {formatCOP(totalOutstanding)}
                </p>
              </CardContent>
            </Card>
            <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Intereses calculados
                </p>
                <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight text-amber-600 dark:text-amber-400">
                  {formatCOP(totalInterest)}
                </p>
              </CardContent>
            </Card>
            <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Tasa efectiva
                </p>
                <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight">
                  {effectiveRate}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main table */}
          <Card className="anim-table">
            <CardHeader className="border-b px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="font-display text-sm">
                    Mora calculada
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Selecciona los cobros a los que deseas aplicar intereses de
                    mora. Revisa los montos antes de confirmar.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={selected.size === 0}
                  onClick={() => {
                    setApplyResult(null);
                    setConfirmOpen(true);
                  }}
                >
                  <Percent className="mr-1.5 h-3 w-3" />
                  Aplicar mora ({selected.size})
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {rows.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-20">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-medium">
                      Sin mora pendiente
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      No hay cobros vencidos para calcular mora
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-10 pl-4">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={toggleAll}
                          />
                        </TableHead>
                        <TableHead className="w-20 text-[11px] font-medium uppercase tracking-wider">
                          Unidad
                        </TableHead>
                        <TableHead className="w-24 text-[11px] font-medium uppercase tracking-wider">
                          Periodo
                        </TableHead>
                        <TableHead className="w-20 text-center text-[11px] font-medium uppercase tracking-wider">
                          Dias
                        </TableHead>
                        <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider">
                          Capital adeudado
                        </TableHead>
                        <TableHead className="pr-4 text-right text-[11px] font-medium uppercase tracking-wider">
                          Interes calculado
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => {
                        const isCritical = row.daysOverdue > 90;
                        const isSelected = selected.has(row.invoiceId);

                        return (
                          <TableRow
                            key={row.invoiceId}
                            className={`cursor-pointer ${
                              isCritical ? "bg-red-500/[0.03]" : ""
                            } ${isSelected ? "" : "opacity-50"}`}
                            onClick={() => toggleRow(row.invoiceId)}
                          >
                            <TableCell className="pl-4">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleRow(row.invoiceId)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-[13px] font-semibold tabular-nums">
                              {row.unitNumber}
                            </TableCell>
                            <TableCell className="text-[13px]">
                              {formatPeriodShort(row.period)}
                            </TableCell>
                            <TableCell className="text-center font-mono text-[13px] font-semibold tabular-nums">
                              {row.daysOverdue}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[13px] tabular-nums">
                              {formatCOP(row.outstanding)}
                            </TableCell>
                            <TableCell className="pr-4 text-right font-mono text-[13px] font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                              {formatCOP(row.interestAmount)}
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
        </>
      )}

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[15px]">
              Confirmar aplicacion de mora
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              Se aplicaran intereses de mora a los cobros seleccionados. Esta
              accion generara asientos contables.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-md border border-border/60 bg-muted/30 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    Unidades
                  </p>
                  <p className="font-mono text-lg font-semibold tabular-nums">
                    {selectedUnits}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    Cobros
                  </p>
                  <p className="font-mono text-lg font-semibold tabular-nums">
                    {selected.size}
                  </p>
                </div>
              </div>
              <div className="mt-3 border-t pt-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Total intereses a aplicar
                </p>
                <p className="font-mono text-xl font-semibold tabular-nums tracking-tight text-amber-600 dark:text-amber-400">
                  {formatCOP(selectedTotal)}
                </p>
              </div>
            </div>

            <p className="text-[12px] text-muted-foreground">
              Se actualizaran los cobros con el monto de mora y se generaran los
              asientos contables correspondientes (DB 1150 CxC mora / CR 4210
              Ingresos mora).
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setConfirmOpen(false)}
                disabled={applying}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={applying}
                onClick={handleApply}
              >
                {applying ? (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                ) : (
                  <Percent className="mr-1.5 h-3 w-3" />
                )}
                Confirmar y aplicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
