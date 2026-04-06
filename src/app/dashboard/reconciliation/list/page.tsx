"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePageTransition } from "@/hooks/use-page-transition";
import { createClient } from "@/lib/supabase/client";
import { formatCOP, formatShortDate } from "@/lib/utils/format";
import type { BankStatement, StatementStatus } from "@/types/database";
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
  GitCompareArrows,
  Upload,
  RefreshCw,
  AlertCircle,
  FileSpreadsheet,
  ChevronRight,
} from "lucide-react";

// -- Status config -----------------------------------------------------------

const STATUS_MAP: Record<
  StatementStatus,
  { label: string; dotClass: string; variant: "default" | "secondary" | "outline" }
> = {
  pending: {
    label: "Pendiente",
    variant: "outline",
    dotClass: "bg-muted-foreground/50",
  },
  in_progress: {
    label: "En proceso",
    variant: "secondary",
    dotClass: "bg-amber-400 shadow-[0_0_4px_1px_rgba(251,191,36,.3)]",
  },
  reconciled: {
    label: "Conciliado",
    variant: "default",
    dotClass: "bg-emerald-400 shadow-[0_0_4px_1px_rgba(52,211,153,.35)]",
  },
};

// -- Page --------------------------------------------------------------------

export default function ReconciliationListPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [statements, setStatements] = useState<BankStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatements = useCallback(async () => {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("bank_statements")
      .select("*")
      .order("period", { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setStatements((data ?? []) as BankStatement[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatements();
  }, [fetchStatements]);

  // -- Derived ---------------------------------------------------------------

  const totalReconciled = statements.filter((s) => s.status === "reconciled").length;
  const totalPending = statements.filter((s) => s.status !== "reconciled").length;

  usePageTransition(containerRef, { ready: !loading });

  // -- Render ----------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="anim-header flex items-end justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-xl tracking-tight">
              Conciliacion bancaria
            </h2>
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Historial de extractos bancarios importados y su estado de
            conciliacion con los registros de Kontabi.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs text-muted-foreground"
            onClick={fetchStatements}
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
            nativeButton={false}
            render={<Link href="/dashboard/reconciliation/import" />}
          >
            <Upload className="mr-1.5 h-3 w-3" />
            Importar extracto
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="anim-banner flex items-center gap-2.5 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Summary strip */}
      {!loading && statements.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
            <CardContent className="p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Total extractos
              </p>
              <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight">
                {statements.length}
              </p>
              <div className="absolute -right-2 -top-2 h-14 w-14 rounded-full bg-foreground/[0.03]" />
            </CardContent>
          </Card>
          <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
            <CardContent className="p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Conciliados
              </p>
              <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
                {totalReconciled}
              </p>
            </CardContent>
          </Card>
          <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
            <CardContent className="p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Pendientes
              </p>
              <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight text-amber-600 dark:text-amber-400">
                {totalPending}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Statements table */}
      <Card className="anim-table">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="font-display text-sm">
            Extractos importados
          </CardTitle>
          <CardDescription className="text-[11px]">
            Seleccione un extracto para ver o continuar la conciliacion
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Cargando extractos...
            </div>
          ) : statements.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground/60" />
              </div>
              <p className="text-[13px] font-medium">Sin extractos importados</p>
              <p className="max-w-xs text-[12px] text-muted-foreground">
                Importe un extracto bancario en formato CSV para iniciar la
                conciliacion con los registros de Kontabi.
              </p>
              <Button
                size="sm"
                className="mt-2 h-8 text-xs"
                nativeButton={false}
                render={<Link href="/dashboard/reconciliation/import" />}
              >
                <Upload className="mr-1.5 h-3 w-3" />
                Importar primer extracto
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4 text-[11px] font-medium uppercase tracking-wider">
                      Periodo
                    </TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                      Banco
                    </TableHead>
                    <TableHead className="w-24 text-center text-[11px] font-medium uppercase tracking-wider">
                      Movimientos
                    </TableHead>
                    <TableHead className="w-32 text-right text-[11px] font-medium uppercase tracking-wider">
                      Debitos
                    </TableHead>
                    <TableHead className="w-32 text-right text-[11px] font-medium uppercase tracking-wider">
                      Creditos
                    </TableHead>
                    <TableHead className="w-28 text-[11px] font-medium uppercase tracking-wider">
                      Estado
                    </TableHead>
                    <TableHead className="w-28 text-[11px] font-medium uppercase tracking-wider">
                      Importado
                    </TableHead>
                    <TableHead className="w-8 pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statements.map((stmt) => {
                    const cfg = STATUS_MAP[stmt.status];
                    return (
                      <TableRow
                        key={stmt.id}
                        className="group cursor-pointer"
                        onClick={() => {
                          window.location.href = `/dashboard/reconciliation/${stmt.id}`;
                        }}
                      >
                        <TableCell className="pl-4 text-[13px] font-medium">
                          {stmt.period}
                        </TableCell>
                        <TableCell className="text-[13px] text-muted-foreground">
                          {stmt.bank_name}
                        </TableCell>
                        <TableCell className="text-center font-mono text-[13px] tabular-nums">
                          {stmt.total_lines}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                          {formatCOP(stmt.total_debits)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                          {formatCOP(stmt.total_credits)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={cfg.variant}
                            className="gap-1.5 text-[11px]"
                          >
                            <span
                              className={`inline-block h-1.5 w-1.5 rounded-full ${cfg.dotClass}`}
                            />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[12px] text-muted-foreground">
                          {formatShortDate(new Date(stmt.imported_at))}
                        </TableCell>
                        <TableCell className="pr-4">
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
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
