"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { usePageTransition } from "@/hooks/use-page-transition";
import { createClient } from "@/lib/supabase/client";
import { markOverdueInvoices } from "@/lib/accounting/late-interest";
import { formatCOP } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Search,
  Loader2,
} from "lucide-react";

// -- Constants ---------------------------------------------------------------

const ACTION_MAP: {
  minDays: number;
  maxDays: number;
  label: string;
  className: string;
}[] = [
  {
    minDays: 0,
    maxDays: 30,
    label: "Recordatorio",
    className: "border-border text-muted-foreground",
  },
  {
    minDays: 31,
    maxDays: 60,
    label: "Notificacion formal",
    className:
      "border-amber-300/40 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400",
  },
  {
    minDays: 61,
    maxDays: 90,
    label: "Carta cobro",
    className:
      "border-orange-300/40 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-400",
  },
  {
    minDays: 91,
    maxDays: 180,
    label: "Cobro juridico",
    className:
      "border-red-300/40 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400",
  },
  {
    minDays: 181,
    maxDays: Infinity,
    label: "Proceso ejecutivo",
    className:
      "border-red-500/40 bg-red-200/60 text-red-900 dark:border-red-500/50 dark:bg-red-500/20 dark:text-red-200",
  },
];

const AGING_FILTERS = [
  { value: "all", label: "Todas" },
  { value: "0-30", label: "0-30 dias" },
  { value: "31-60", label: "31-60 dias" },
  { value: "61-90", label: "61-90 dias" },
  { value: "91-180", label: "91-180 dias" },
  { value: "180+", label: "> 180 dias" },
];

// -- Types -------------------------------------------------------------------

interface OverdueRow {
  id: string;
  unitId: string;
  unitNumber: string;
  tower: string | null;
  ownerName: string | null;
  period: string;
  total: number;
  paidAmount: number;
  outstanding: number;
  dueDate: string;
  daysOverdue: number;
}

// -- Helpers -----------------------------------------------------------------

function getDaysOverdue(dueDate: string): number {
  const today = new Date();
  const due = new Date(dueDate);
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000));
}

function getAction(days: number) {
  return (
    ACTION_MAP.find((a) => days >= a.minDays && days <= a.maxDays) ??
    ACTION_MAP[ACTION_MAP.length - 1]
  );
}

function matchesAgingFilter(days: number, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "0-30") return days >= 0 && days <= 30;
  if (filter === "31-60") return days >= 31 && days <= 60;
  if (filter === "61-90") return days >= 61 && days <= 90;
  if (filter === "91-180") return days >= 91 && days <= 180;
  if (filter === "180+") return days > 180;
  return true;
}

function formatPeriodShort(period: string): string {
  const [year, month] = period.split("-");
  const months = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];
  return `${months[Number(month) - 1]} ${year}`;
}

// -- Page --------------------------------------------------------------------

export default function OverduePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<OverdueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterTower, setFilterTower] = useState<string>("all");
  const [filterAging, setFilterAging] = useState<string>("all");
  const [searchUnit, setSearchUnit] = useState<string>("");

  // -- Fetch -----------------------------------------------------------------

  const fetchOverdue = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data: invoices, error: invErr } = await supabase
        .from("invoices")
        .select(
          "id, unit_id, period, total, paid_amount, due_date, unit:units!inner(number, building:buildings(name))"
        )
        .eq("status", "overdue")
        .order("due_date", { ascending: true });

      if (invErr) throw new Error(invErr.message);

      const rawInvoices = invoices ?? [];

      // Collect unique unit_ids to find their owners
      const unitIds = [...new Set(rawInvoices.map((i) => i.unit_id))];

      const ownerMap = new Map<string, string>();
      if (unitIds.length > 0) {
        const { data: owners } = await supabase
          .from("owners")
          .select("unit_id, full_name")
          .in("unit_id", unitIds)
          .eq("is_current", true);
        for (const o of owners ?? []) {
          ownerMap.set(o.unit_id, o.full_name);
        }
      }

      const mapped: OverdueRow[] = rawInvoices.map((inv) => {
        const unit = inv.unit as unknown as {
          number: string;
          building: { name: string } | null;
        };
        return {
          id: inv.id,
          unitId: inv.unit_id,
          unitNumber: unit.number,
          tower: unit.building?.name ?? null,
          ownerName: ownerMap.get(inv.unit_id) ?? null,
          period: inv.period,
          total: Number(inv.total),
          paidAmount: Number(inv.paid_amount),
          outstanding: Number(inv.total) - Number(inv.paid_amount),
          dueDate: inv.due_date,
          daysOverdue: getDaysOverdue(inv.due_date),
        };
      });

      setRows(mapped);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMarkOverdue = async () => {
    setMarking(true);
    await markOverdueInvoices();
    setMarking(false);
    await fetchOverdue();
  };

  useEffect(() => {
    // Mark overdue then fetch
    markOverdueInvoices()
      .catch(() => {})
      .finally(() => fetchOverdue());
  }, [fetchOverdue]);

  // -- Filtered rows ---------------------------------------------------------

  const towers = useMemo(
    () =>
      [...new Set(rows.map((r) => r.tower).filter(Boolean) as string[])].sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterTower !== "all" && r.tower !== filterTower) return false;
      if (!matchesAgingFilter(r.daysOverdue, filterAging)) return false;
      if (
        searchUnit &&
        !r.unitNumber.toLowerCase().includes(searchUnit.toLowerCase())
      )
        return false;
      return true;
    });
  }, [rows, filterTower, filterAging, searchUnit]);

  // -- KPIs ------------------------------------------------------------------

  const totalOverdue = filtered.length;
  const totalAmount = filtered.reduce((s, r) => s + r.outstanding, 0);
  const avgDays =
    filtered.length > 0
      ? Math.round(
          filtered.reduce((s, r) => s + r.daysOverdue, 0) / filtered.length
        )
      : 0;
  const affectedUnits = new Set(filtered.map((r) => r.unitId)).size;

  usePageTransition(containerRef, { ready: !loading });

  // -- Render ----------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="anim-header flex items-end justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-xl tracking-tight">
              Cuotas vencidas
            </h2>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Cobros con fecha de vencimiento superada, pendientes de pago
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={handleMarkOverdue}
            disabled={marking}
          >
            {marking ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <AlertTriangle className="mr-1.5 h-3 w-3" />
            )}
            Actualizar vencimientos
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs text-muted-foreground"
            onClick={fetchOverdue}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-1.5 h-3 w-3 ${loading ? "animate-spin" : ""}`}
            />
            Recargar
          </Button>
        </div>
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
          Cargando cuotas vencidas...
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    Total vencidas
                  </p>
                </div>
                <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight text-red-500">
                  {totalOverdue}
                </p>
                <div className="absolute -right-2 -top-2 h-14 w-14 rounded-full bg-red-500/[0.04]" />
              </CardContent>
            </Card>
            <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Monto total vencido
                </p>
                <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight text-red-600 dark:text-red-400">
                  {formatCOP(totalAmount)}
                </p>
              </CardContent>
            </Card>
            <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Promedio dias vencido
                </p>
                <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight">
                  {avgDays}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    dias
                  </span>
                </p>
              </CardContent>
            </Card>
            <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Unidades afectadas
                </p>
                <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight">
                  {affectedUnits}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters + table */}
          <Card className="anim-table">
            <CardHeader className="border-b px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="font-display text-sm">
                    Detalle de cuotas vencidas
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Filtrar por torre, antiguedad o numero de unidad
                  </CardDescription>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {towers.length > 0 && (
                    <Select value={filterTower} onValueChange={(v) => setFilterTower(v ?? "all")}>
                      <SelectTrigger className="h-7 w-[120px] text-[11px]">
                        <SelectValue placeholder="Torre" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-[12px]">
                          Todas las torres
                        </SelectItem>
                        {towers.map((t) => (
                          <SelectItem key={t} value={t} className="text-[12px]">
                            Torre {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Select value={filterAging} onValueChange={(v) => setFilterAging(v ?? "all")}>
                    <SelectTrigger className="h-7 w-[120px] text-[11px]">
                      <SelectValue placeholder="Antiguedad" />
                    </SelectTrigger>
                    <SelectContent>
                      {AGING_FILTERS.map((f) => (
                        <SelectItem
                          key={f.value}
                          value={f.value}
                          className="text-[12px]"
                        >
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50" />
                    <Input
                      placeholder="Buscar unidad..."
                      value={searchUnit}
                      onChange={(e) => setSearchUnit(e.target.value)}
                      className="h-7 w-[130px] pl-7 text-[11px]"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-20">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-medium">
                      Sin cuotas vencidas
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {rows.length > 0
                        ? "No hay resultados para los filtros seleccionados"
                        : "Todas las unidades estan al dia con sus pagos"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-20 pl-4 text-[11px] font-medium uppercase tracking-wider">
                          Unidad
                        </TableHead>
                        <TableHead className="w-20 text-[11px] font-medium uppercase tracking-wider">
                          Torre
                        </TableHead>
                        <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                          Propietario
                        </TableHead>
                        <TableHead className="w-24 text-[11px] font-medium uppercase tracking-wider">
                          Periodo
                        </TableHead>
                        <TableHead className="w-28 text-right text-[11px] font-medium uppercase tracking-wider">
                          Total
                        </TableHead>
                        <TableHead className="w-28 text-right text-[11px] font-medium uppercase tracking-wider">
                          Pagado
                        </TableHead>
                        <TableHead className="w-28 text-right text-[11px] font-medium uppercase tracking-wider">
                          Pendiente
                        </TableHead>
                        <TableHead className="w-24 text-[11px] font-medium uppercase tracking-wider">
                          Vencimiento
                        </TableHead>
                        <TableHead className="w-16 text-center text-[11px] font-medium uppercase tracking-wider">
                          Dias
                        </TableHead>
                        <TableHead className="w-36 pr-4 text-right text-[11px] font-medium uppercase tracking-wider">
                          Accion sugerida
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((row) => {
                        const action = getAction(row.daysOverdue);
                        const isCritical = row.daysOverdue > 90;

                        return (
                          <TableRow
                            key={row.id}
                            className={
                              isCritical ? "bg-red-500/[0.03]" : ""
                            }
                          >
                            <TableCell className="pl-4 font-mono text-[13px] font-semibold tabular-nums">
                              {row.unitNumber}
                            </TableCell>
                            <TableCell className="text-[13px] text-muted-foreground">
                              {row.tower ?? "--"}
                            </TableCell>
                            <TableCell className="max-w-[160px] truncate text-[13px]">
                              {row.ownerName ?? "--"}
                            </TableCell>
                            <TableCell className="text-[13px]">
                              {formatPeriodShort(row.period)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[13px] tabular-nums">
                              {formatCOP(row.total)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                              {row.paidAmount > 0
                                ? formatCOP(row.paidAmount)
                                : "--"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[13px] font-semibold tabular-nums text-red-600 dark:text-red-400">
                              {formatCOP(row.outstanding)}
                            </TableCell>
                            <TableCell className="font-mono text-[12px] tabular-nums text-muted-foreground">
                              {row.dueDate}
                            </TableCell>
                            <TableCell className="text-center font-mono text-[13px] font-semibold tabular-nums">
                              {row.daysOverdue}
                            </TableCell>
                            <TableCell className="pr-4 text-right">
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${action.className}`}
                              >
                                {action.label}
                              </Badge>
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
    </div>
  );
}
