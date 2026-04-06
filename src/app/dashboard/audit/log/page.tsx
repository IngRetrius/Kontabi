"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePageTransition } from "@/hooks/use-page-transition";
import type { AuditLog } from "@/types/database";
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
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

// -- Constants ---------------------------------------------------------------

const PAGE_SIZE = 25;

const OP_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  INSERT: { label: "Creacion", variant: "default" },
  UPDATE: { label: "Actualizacion", variant: "secondary" },
  DELETE: { label: "Eliminacion", variant: "outline" },
};

const OP_ICON: Record<string, typeof Plus> = {
  INSERT: Plus,
  UPDATE: Pencil,
  DELETE: Trash2,
};

const TABLE_LABELS: Record<string, string> = {
  transactions: "Transacciones",
  journal_entries: "Asientos",
  journal_entry_lines: "Lineas de asiento",
  invoices: "Cobros",
  payments: "Pagos",
  units: "Unidades",
  owners: "Propietarios",
  budgets: "Presupuestos",
  budget_items: "Items de presupuesto",
  accounts: "Cuentas",
  tenants: "Conjuntos",
  tenant_settings: "Configuracion",
  period_locks: "Bloqueos",
  bank_accounts: "Cuentas bancarias",
  bank_statements: "Extractos",
  bank_statement_rows: "Movimientos bancarios",
  assemblies: "Actas",
  extraordinary_quotas: "Cuotas extra",
};

// -- Page --------------------------------------------------------------------

export default function AuditLogPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTable, setSearchTable] = useState("");
  const [detail, setDetail] = useState<AuditLog | null>(null);

  // -- Fetch -----------------------------------------------------------------

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      let query = supabase
        .from("audit_log")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (searchTable.trim()) {
        query = query.ilike("table_name", `%${searchTable.trim()}%`);
      }

      const { data, error: err, count } = await query;

      if (err) throw new Error(err.message);
      setLogs((data as AuditLog[]) ?? []);
      setTotalCount(count ?? 0);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, searchTable]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  usePageTransition(containerRef, { ready: !loading });

  // -- Derived ---------------------------------------------------------------

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // -- Loading ---------------------------------------------------------------

  if (loading && logs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/40 ring-1 ring-foreground/5" />
      </div>
    );
  }

  // -- Render ----------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="anim-header flex items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl tracking-tight">
            Registro de auditoria
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Historial inmutable de cambios realizados en el sistema
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2.5 text-xs text-muted-foreground"
          onClick={fetchLogs}
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

      {/* Stats */}
      <Card className="anim-card">
        <CardHeader className="border-b px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
              <CardTitle className="font-display text-sm">
                Eventos registrados
              </CardTitle>
            </div>
            <Badge variant="secondary" className="tabular-nums">
              {totalCount}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 py-3">
          {/* Search */}
          <div className="relative mb-4 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTable}
              onChange={(e) => {
                setSearchTable(e.target.value);
                setPage(0);
              }}
              placeholder="Filtrar por tabla..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          {/* Table */}
          {logs.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-16 text-center">
              <ShieldCheck className="h-5 w-5 text-muted-foreground/40" />
              <p className="text-[13px] font-medium">Sin registros</p>
              <p className="text-[12px] text-muted-foreground/60">
                {searchTable
                  ? "No hay eventos para este filtro"
                  : "Aun no se han registrado cambios auditables"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-36 pl-4 text-[11px] font-medium uppercase tracking-wider">
                    Fecha
                  </TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                    Tabla
                  </TableHead>
                  <TableHead className="w-28 text-[11px] font-medium uppercase tracking-wider">
                    Operacion
                  </TableHead>
                  <TableHead className="w-24 text-[11px] font-medium uppercase tracking-wider">
                    Registro
                  </TableHead>
                  <TableHead className="w-12 pr-4 text-right text-[11px] font-medium uppercase tracking-wider" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const op = OP_BADGE[log.operation] ?? {
                    label: log.operation,
                    variant: "outline" as const,
                  };
                  const OpIcon = OP_ICON[log.operation] ?? Pencil;

                  return (
                    <TableRow key={log.id}>
                      <TableCell className="pl-4 font-mono text-[12px] tabular-nums text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("es-CO", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="text-[13px]">
                        <div className="flex items-center gap-1.5">
                          <OpIcon className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                          <span>
                            {TABLE_LABELS[log.table_name] ?? log.table_name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={op.variant} className="text-[10px]">
                          {op.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate font-mono text-[11px] text-muted-foreground">
                        {log.record_id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setDetail(log)}
                          title="Ver detalle"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between border-t border-border/40 pt-3">
              <p className="text-[11px] text-muted-foreground tabular-nums">
                Pagina {page + 1} de {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={page === 0}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-sm">
              Detalle del evento
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    Tabla
                  </p>
                  <p className="mt-0.5 font-medium">
                    {TABLE_LABELS[detail.table_name] ?? detail.table_name}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    Operacion
                  </p>
                  <p className="mt-0.5">
                    <Badge variant={OP_BADGE[detail.operation]?.variant ?? "outline"}>
                      {OP_BADGE[detail.operation]?.label ?? detail.operation}
                    </Badge>
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    Registro
                  </p>
                  <p className="mt-0.5 font-mono text-xs">{detail.record_id}</p>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    Fecha
                  </p>
                  <p className="mt-0.5 font-mono text-xs">
                    {new Date(detail.created_at).toLocaleString("es-CO")}
                  </p>
                </div>
              </div>

              {detail.old_data && (
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    Datos anteriores
                  </p>
                  <pre className="max-h-40 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                    {JSON.stringify(detail.old_data, null, 2)}
                  </pre>
                </div>
              )}

              {detail.new_data && (
                <div>
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    Datos nuevos
                  </p>
                  <pre className="max-h-40 overflow-auto rounded-lg bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                    {JSON.stringify(detail.new_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
