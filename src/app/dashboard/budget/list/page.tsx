"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePageTransition } from "@/hooks/use-page-transition";
import { createClient } from "@/lib/supabase/client";
import type { Budget } from "@/types/database";
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
  Plus,
  Eye,
  CheckCircle2,
  Zap,
  Trash2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

// -- Status config -----------------------------------------------------------

const STATUS_MAP: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "outline";
    dotClass: string;
  }
> = {
  draft: {
    label: "Borrador",
    variant: "outline",
    dotClass: "bg-muted-foreground/50",
  },
  approved: {
    label: "Aprobado",
    variant: "secondary",
    dotClass: "bg-sky-400",
  },
  active: {
    label: "Vigente",
    variant: "default",
    dotClass: "bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,.35)]",
  },
};

// -- Page --------------------------------------------------------------------

export default function BudgetListPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Budget | null>(null);
  const [activating, setActivating] = useState<string | null>(null);

  // -- Fetch -----------------------------------------------------------------

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data, error: err } = await supabase
      .from("budgets")
      .select("*")
      .order("year", { ascending: false })
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setBudgets((data ?? []) as Budget[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  // -- Actions ---------------------------------------------------------------

  const handleActivate = async (budget: Budget) => {
    setActivating(budget.id);
    const supabase = createClient();
    const { error: err } = await supabase
      .from("budgets")
      .update({ status: "active" })
      .eq("id", budget.id);

    if (err) setError(err.message);
    else await fetchBudgets();
    setActivating(null);
  };

  const handleApprove = async (budget: Budget) => {
    const supabase = createClient();
    const { error: err } = await supabase
      .from("budgets")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", budget.id);

    if (err) setError(err.message);
    else await fetchBudgets();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const supabase = createClient();
    const { error: err } = await supabase
      .from("budgets")
      .delete()
      .eq("id", deleteTarget.id);

    if (err) setError(err.message);
    else {
      setDeleteTarget(null);
      await fetchBudgets();
    }
  };

  // -- Derived data ----------------------------------------------------------

  const activeBudget = budgets.find((b) => b.status === "active");
  const draftCount = budgets.filter((b) => b.status === "draft").length;

  usePageTransition(containerRef, { ready: !loading });

  // -- Render ----------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-6">
      {/* ---- Header ---- */}
      <div className="anim-header flex items-end justify-between gap-4">
        <div className="space-y-0.5">
          <h2 className="font-display text-xl tracking-tight">
            Presupuestos anuales
          </h2>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Gestion presupuestal de la copropiedad. Solo un presupuesto puede
            estar vigente por ano fiscal.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchBudgets}
            disabled={loading}
            className="h-8 px-2.5 text-xs text-muted-foreground"
          >
            <RefreshCw
              className={`mr-1.5 h-3 w-3 ${loading ? "animate-spin" : ""}`}
            />
            Recargar
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => router.push("/dashboard/budget/new")}
          >
            <Plus className="mr-1.5 h-3 w-3" />
            Nuevo presupuesto
          </Button>
        </div>
      </div>

      {/* ---- KPI strip ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total */}
        <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Registrados
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {budgets.length}
            </p>
            <div className="absolute -right-2 -top-2 h-16 w-16 rounded-full bg-foreground/[0.03]" />
          </CardContent>
        </Card>

        {/* Active budget total */}
        <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,.4)]" />
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Vigente
              </p>
            </div>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {activeBudget ? formatCOP(activeBudget.total) : "--"}
            </p>
            {activeBudget && (
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                {formatCOP(Math.round(activeBudget.total / 12))}/mes
              </p>
            )}
            <div className="absolute -right-2 -top-2 h-16 w-16 rounded-full bg-emerald-500/[0.06]" />
          </CardContent>
        </Card>

        {/* Drafts */}
        <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Borradores
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {draftCount}
            </p>
            <div className="absolute -right-2 -top-2 h-16 w-16 rounded-full bg-foreground/[0.03]" />
          </CardContent>
        </Card>
      </div>

      {/* ---- Error banner ---- */}
      {error && (
        <div className="anim-banner flex items-center gap-2.5 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ---- Data table ---- */}
      <Card className="anim-table">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="font-display text-sm">Historial</CardTitle>
          <CardDescription className="text-[11px]">
            Presupuestos ordenados por ano. Aprueba un borrador y luego activalo
            para habilitar la facturacion.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Cargando...
            </div>
          ) : budgets.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border">
                <Plus className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <div className="text-center">
                <p className="text-[13px] font-medium">Sin presupuestos</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Crea el primer presupuesto anual para comenzar
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-1 h-7 text-[12px]"
                onClick={() => router.push("/dashboard/budget/new")}
              >
                Crear presupuesto
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-16 pl-4 text-[11px] font-medium uppercase tracking-wider">
                      Ano
                    </TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                      Nombre
                    </TableHead>
                    <TableHead className="w-28 text-[11px] font-medium uppercase tracking-wider">
                      Estado
                    </TableHead>
                    <TableHead className="w-36 text-right text-[11px] font-medium uppercase tracking-wider">
                      Total anual
                    </TableHead>
                    <TableHead className="w-32 text-right text-[11px] font-medium uppercase tracking-wider">
                      Mensual
                    </TableHead>
                    <TableHead className="w-28 text-right text-[11px] font-medium uppercase tracking-wider">
                      Reserva
                    </TableHead>
                    <TableHead className="w-28 pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgets.map((budget) => {
                    const st = STATUS_MAP[budget.status];
                    const monthly = Math.round(budget.total / 12);
                    const reserveAmt = Math.round(
                      budget.total * (budget.reserve_fund_pct / 100)
                    );
                    const isActive = budget.status === "active";

                    return (
                      <TableRow
                        key={budget.id}
                        className={
                          isActive
                            ? "bg-emerald-500/[0.04] hover:bg-emerald-500/[0.07]"
                            : ""
                        }
                      >
                        <TableCell className="pl-4 font-mono text-[13px] font-semibold tabular-nums">
                          {budget.year}
                        </TableCell>
                        <TableCell className="text-[13px] font-medium">
                          {budget.name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={st.variant}
                            className="gap-1.5 text-[11px]"
                          >
                            <span
                              className={`inline-block h-1.5 w-1.5 rounded-full ${st.dotClass}`}
                            />
                            {st.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-[13px] tabular-nums">
                          {formatCOP(budget.total)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                          {formatCOP(monthly)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                          {budget.reserve_fund_pct}%
                          <span className="ml-1 text-[11px] text-muted-foreground/60">
                            ({formatCOP(reserveAmt)})
                          </span>
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() =>
                                router.push(
                                  `/dashboard/budget/${budget.id}`
                                )
                              }
                              title="Ver detalle"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>

                            {budget.status === "draft" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="h-7 w-7 text-muted-foreground hover:text-sky-500"
                                  onClick={() => handleApprove(budget)}
                                  title="Aprobar"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                  onClick={() => setDeleteTarget(budget)}
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}

                            {budget.status === "approved" && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-7 w-7 text-muted-foreground hover:text-amber-500"
                                disabled={activating === budget.id}
                                onClick={() => handleActivate(budget)}
                                title="Activar como vigente"
                              >
                                <Zap className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
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

      {/* ---- Delete dialog ---- */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[15px]">
              Eliminar presupuesto
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              Se eliminara permanentemente{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>{" "}
              ({deleteTarget?.year}) y todos sus rubros. Esta accion no se puede
              deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setDeleteTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 text-xs"
              onClick={handleDelete}
            >
              <Trash2 className="mr-1.5 h-3 w-3" />
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
