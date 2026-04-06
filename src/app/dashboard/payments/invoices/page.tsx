"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePageTransition } from "@/hooks/use-page-transition";
import { createClient } from "@/lib/supabase/client";
import type { Invoice, InvoiceStatus } from "@/types/database";
import { generateMonthlyInvoices } from "@/lib/accounting/quota";
import { formatCOP, formatPeriod } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Receipt,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";

// -- Status config -----------------------------------------------------------

const STATUS_MAP: Record<
  InvoiceStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; dotClass: string }
> = {
  pending: {
    label: "Pendiente",
    variant: "outline",
    dotClass: "bg-muted-foreground/50",
  },
  partial: {
    label: "Parcial",
    variant: "secondary",
    dotClass: "bg-amber-400 shadow-[0_0_4px_1px_rgba(251,191,36,.3)]",
  },
  paid: {
    label: "Pagado",
    variant: "default",
    dotClass: "bg-emerald-400 shadow-[0_0_4px_1px_rgba(52,211,153,.35)]",
  },
  overdue: {
    label: "Vencido",
    variant: "destructive",
    dotClass: "bg-red-400 shadow-[0_0_4px_1px_rgba(248,113,113,.35)]",
  },
};

// -- Types -------------------------------------------------------------------

interface InvoiceWithUnit extends Invoice {
  unit?: { number: string } | null;
}

// -- Helpers -----------------------------------------------------------------

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function defaultDueDate(): string {
  const now = new Date();
  const day = 15;
  const due = new Date(now.getFullYear(), now.getMonth(), day);
  return due.toISOString().split("T")[0];
}

// -- Page --------------------------------------------------------------------

export default function InvoicesPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [invoices, setInvoices] = useState<InvoiceWithUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterPeriod, setFilterPeriod] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Generation dialog
  const [genOpen, setGenOpen] = useState(false);
  const [genPeriod, setGenPeriod] = useState(currentPeriod());
  const [genDueDate, setGenDueDate] = useState(defaultDueDate());
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{
    created: number;
    skipped: number;
  } | null>(null);

  // -- Fetch invoices --------------------------------------------------------

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    let query = supabase
      .from("invoices")
      .select("*, unit:units(number)")
      .order("period", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);

    if (filterPeriod) {
      query = query.eq("period", filterPeriod);
    }
    if (filterStatus && filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    const { data, error: err } = await query;

    if (err) {
      setError(err.message);
    } else {
      setInvoices((data ?? []) as InvoiceWithUnit[]);
    }
    setLoading(false);
  }, [filterPeriod, filterStatus]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // -- Generate invoices -----------------------------------------------------

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setGenResult(null);

    const { created, skipped, error: err } = await generateMonthlyInvoices(
      genPeriod,
      genDueDate
    );

    if (err) {
      setError(err);
      setGenerating(false);
      return;
    }

    setGenResult({ created, skipped });
    setGenerating(false);
    await fetchInvoices();
  };

  // -- Periods for filter (derived from data) --------------------------------

  const periods = Array.from(new Set(invoices.map((i) => i.period))).sort(
    (a, b) => b.localeCompare(a)
  );

  // -- KPIs ------------------------------------------------------------------

  const totalInvoices = invoices.length;
  const totalAmount = invoices.reduce((s, i) => s + i.total, 0);
  const paidCount = invoices.filter((i) => i.status === "paid").length;
  const pendingCount = invoices.filter((i) => i.status === "pending").length;
  const overdueCount = invoices.filter((i) => i.status === "overdue").length;

  usePageTransition(containerRef, { ready: !loading });

  // -- Render ----------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-6">
      {/* ---- Header ---- */}
      <div className="anim-header flex items-end justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-xl tracking-tight">Cobros</h2>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Cobros mensuales generados desde el presupuesto vigente
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs text-muted-foreground"
            onClick={fetchInvoices}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-1.5 h-3 w-3 ${loading ? "animate-spin" : ""}`}
            />
            Recargar
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setGenResult(null);
              setGenOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-3 w-3" />
            Generar cobros del mes
          </Button>
        </div>
      </div>

      {/* ---- KPI strip ---- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Total cobros
            </p>
            <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {totalInvoices}
            </p>
            <div className="absolute -right-2 -top-2 h-14 w-14 rounded-full bg-foreground/[0.03]" />
          </CardContent>
        </Card>
        <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Monto total
            </p>
            <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight">
              {formatCOP(totalAmount)}
            </p>
          </CardContent>
        </Card>
        <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Pagados
              </p>
            </div>
            <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {paidCount}
            </p>
          </CardContent>
        </Card>
        <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Pendientes
              </p>
            </div>
            <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {pendingCount}
            </p>
          </CardContent>
        </Card>
        <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Vencidos
              </p>
            </div>
            <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight text-red-500">
              {overdueCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ---- Error ---- */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* ---- Filters + Table ---- */}
      <Card className="anim-table">
        <CardHeader className="border-b px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="font-display text-sm">
                Historial de cobros
              </CardTitle>
              <CardDescription className="text-[11px]">
                Filtrar por periodo o estado. Cada cobro corresponde a una unidad
                en un mes.
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                <SelectTrigger className="h-7 w-[130px] text-[11px]">
                  <SelectValue placeholder="Periodo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="text-[12px]">
                    Todos
                  </SelectItem>
                  {periods.map((p) => (
                    <SelectItem key={p} value={p} className="text-[12px]">
                      {formatPeriod(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-7 w-[120px] text-[11px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-[12px]">
                    Todos
                  </SelectItem>
                  {Object.entries(STATUS_MAP).map(([key, cfg]) => (
                    <SelectItem key={key} value={key} className="text-[12px]">
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Cargando cobros...
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border">
                <Receipt className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <div className="text-center">
                <p className="text-[13px] font-medium">Sin cobros</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  Genera los cobros del mes desde el presupuesto vigente
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-1 h-7 text-[12px]"
                onClick={() => {
                  setGenResult(null);
                  setGenOpen(true);
                }}
              >
                Generar cobros
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-20 pl-4 text-[11px] font-medium uppercase tracking-wider">
                      Unidad
                    </TableHead>
                    <TableHead className="w-28 text-[11px] font-medium uppercase tracking-wider">
                      Periodo
                    </TableHead>
                    <TableHead className="w-28 text-right text-[11px] font-medium uppercase tracking-wider">
                      Cuota
                    </TableHead>
                    <TableHead className="w-28 text-right text-[11px] font-medium uppercase tracking-wider">
                      Extra
                    </TableHead>
                    <TableHead className="w-24 text-right text-[11px] font-medium uppercase tracking-wider">
                      Mora
                    </TableHead>
                    <TableHead className="w-32 text-right text-[11px] font-medium uppercase tracking-wider">
                      Total
                    </TableHead>
                    <TableHead className="w-28 text-[11px] font-medium uppercase tracking-wider">
                      Estado
                    </TableHead>
                    <TableHead className="w-24 pr-4 text-right text-[11px] font-medium uppercase tracking-wider">
                      Vencimiento
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => {
                    const st = STATUS_MAP[inv.status];
                    const isOverdue = inv.status === "overdue";

                    return (
                      <TableRow
                        key={inv.id}
                        className={
                          isOverdue ? "bg-red-500/[0.03]" : ""
                        }
                      >
                        <TableCell className="pl-4 font-mono text-[13px] font-semibold tabular-nums">
                          {inv.unit?.number ?? "--"}
                        </TableCell>
                        <TableCell className="text-[13px]">
                          {formatPeriod(inv.period)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[13px] tabular-nums">
                          {formatCOP(inv.quota_amount)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                          {inv.extraordinary_amount > 0
                            ? formatCOP(inv.extraordinary_amount)
                            : "--"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                          {inv.late_fee_amount > 0
                            ? formatCOP(inv.late_fee_amount)
                            : "--"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[13px] font-semibold tabular-nums">
                          {formatCOP(inv.total)}
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
                        <TableCell className="pr-4 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                          {inv.due_date}
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

      {/* ---- Generation dialog ---- */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[15px]">
              Generar cobros del mes
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              Se generaran cobros para todas las unidades activas usando el
              presupuesto vigente. Unidades con cobro existente seran omitidas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Periodo
                </Label>
                <Input
                  type="month"
                  value={genPeriod}
                  onChange={(e) => setGenPeriod(e.target.value)}
                  className="h-8 font-mono text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Fecha vencimiento
                </Label>
                <Input
                  type="date"
                  value={genDueDate}
                  onChange={(e) => setGenDueDate(e.target.value)}
                  className="h-8 font-mono text-[13px]"
                />
              </div>
            </div>

            {/* Result feedback */}
            {genResult && (
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-[13px]">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">
                    {genResult.created} cobros generados
                  </span>
                </div>
                {genResult.skipped > 0 && (
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {genResult.skipped} unidades omitidas (ya tenian cobro)
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setGenOpen(false)}
              >
                {genResult ? "Cerrar" : "Cancelar"}
              </Button>
              {!genResult && (
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={generating || !genPeriod || !genDueDate}
                  onClick={handleGenerate}
                >
                  {generating ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <Receipt className="mr-1.5 h-3 w-3" />
                  )}
                  Generar
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
