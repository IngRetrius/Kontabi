"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePageTransition } from "@/hooks/use-page-transition";
import { createClient } from "@/lib/supabase/client";
import {
  runMatchingEngine,
  type MatchResult,
} from "@/lib/reconciliation/matching-engine";
import { formatCOP, formatShortDate } from "@/lib/utils/format";
import type {
  BankStatement,
  BankStatementLine,
  MatchStatus,
  ConfidenceLevel,
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
  GitCompareArrows,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  CircleDot,
  XCircle,
  Loader2,
  Zap,
  Check,
  X,
  RotateCcw,
  Ban,
} from "lucide-react";

// -- Status config -----------------------------------------------------------

const MATCH_STATUS_CFG: Record<
  MatchStatus,
  { label: string; icon: typeof CheckCircle2; color: string }
> = {
  pending: {
    label: "Pendiente",
    icon: CircleDot,
    color: "text-muted-foreground",
  },
  matched: {
    label: "Conciliado",
    icon: CheckCircle2,
    color: "text-emerald-500",
  },
  manual: {
    label: "Manual",
    icon: CheckCircle2,
    color: "text-blue-500",
  },
  excluded: {
    label: "Excluido",
    icon: XCircle,
    color: "text-muted-foreground/50",
  },
};

const CONFIDENCE_CFG: Record<ConfidenceLevel, { label: string; color: string }> = {
  high: { label: "Alta", color: "bg-emerald-500" },
  medium: { label: "Media", color: "bg-amber-400" },
  low: { label: "Baja", color: "bg-red-400" },
};

// -- Types -------------------------------------------------------------------

interface EnrichedLine extends BankStatementLine {
  matchResult?: MatchResult;
  matchedTxDesc?: string;
}

// -- Page --------------------------------------------------------------------

export default function ReconciliationDetailPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [statement, setStatement] = useState<BankStatement | null>(null);
  const [lines, setLines] = useState<EnrichedLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [matching, setMatching] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -- Fetch -----------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const [stmtRes, linesRes] = await Promise.all([
      supabase
        .from("bank_statements")
        .select("*")
        .eq("id", id)
        .single(),
      supabase
        .from("bank_statement_lines")
        .select("*")
        .eq("statement_id", id)
        .order("line_date"),
    ]);

    if (stmtRes.error) {
      setError(stmtRes.error.message);
      setLoading(false);
      return;
    }

    setStatement(stmtRes.data as BankStatement);
    setLines((linesRes.data ?? []) as EnrichedLine[]);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -- Auto-match ------------------------------------------------------------

  async function handleAutoMatch() {
    if (!id) return;
    setMatching(true);
    setError(null);

    const { results, error: matchErr } = await runMatchingEngine(id);

    if (matchErr) {
      setError(matchErr);
      setMatching(false);
      return;
    }

    // Build a map of line matches
    const matchMap = new Map(results.map((r) => [r.lineId, r]));

    // Save auto-matches to database
    const supabase = createClient();
    const toInsert: {
      statement_line_id: string;
      transaction_id: string;
      score: number;
      match_type: string;
      confirmed: boolean;
    }[] = [];

    for (const result of results) {
      if (result.bestMatch && result.bestMatch.confidence === "high") {
        toInsert.push({
          statement_line_id: result.lineId,
          transaction_id: result.bestMatch.transactionId,
          score: result.bestMatch.score,
          match_type: "auto",
          confirmed: false,
        });
      }
    }

    if (toInsert.length > 0) {
      await supabase.from("reconciliation_matches").insert(toInsert);
    }

    // Fetch transaction descriptions for matched items
    const txIds = results
      .filter((r) => r.bestMatch)
      .map((r) => r.bestMatch!.transactionId);

    let txDescMap = new Map<string, string>();
    if (txIds.length > 0) {
      const { data: txs } = await supabase
        .from("transactions")
        .select("id, description")
        .in("id", txIds);

      txDescMap = new Map((txs ?? []).map((t) => [t.id, t.description]));
    }

    // Update lines state
    setLines((prev) =>
      prev.map((line) => {
        const mr = matchMap.get(line.id);
        return {
          ...line,
          matchResult: mr,
          matchedTxDesc: mr?.bestMatch
            ? txDescMap.get(mr.bestMatch.transactionId)
            : undefined,
        };
      })
    );

    // Update statement status
    await supabase
      .from("bank_statements")
      .update({ status: "in_progress" })
      .eq("id", id);

    setStatement((prev) =>
      prev ? { ...prev, status: "in_progress" } : prev
    );
    setMatching(false);
  }

  // -- Confirm match ---------------------------------------------------------

  async function handleConfirmMatch(lineId: string, transactionId: string) {
    const supabase = createClient();

    await supabase
      .from("bank_statement_lines")
      .update({
        match_status: "matched",
        matched_transaction_id: transactionId,
      })
      .eq("id", lineId);

    await supabase
      .from("reconciliation_matches")
      .update({ confirmed: true, confirmed_at: new Date().toISOString() })
      .eq("statement_line_id", lineId)
      .eq("transaction_id", transactionId);

    setLines((prev) =>
      prev.map((l) =>
        l.id === lineId
          ? { ...l, match_status: "matched" as MatchStatus, matched_transaction_id: transactionId }
          : l
      )
    );
  }

  // -- Exclude line ----------------------------------------------------------

  async function handleExclude(lineId: string) {
    const supabase = createClient();
    await supabase
      .from("bank_statement_lines")
      .update({ match_status: "excluded" })
      .eq("id", lineId);

    setLines((prev) =>
      prev.map((l) =>
        l.id === lineId
          ? { ...l, match_status: "excluded" as MatchStatus }
          : l
      )
    );
  }

  // -- Reset line ------------------------------------------------------------

  async function handleReset(lineId: string) {
    const supabase = createClient();
    await supabase
      .from("bank_statement_lines")
      .update({ match_status: "pending", matched_transaction_id: null })
      .eq("id", lineId);

    await supabase
      .from("reconciliation_matches")
      .delete()
      .eq("statement_line_id", lineId);

    setLines((prev) =>
      prev.map((l) =>
        l.id === lineId
          ? { ...l, match_status: "pending" as MatchStatus, matched_transaction_id: null }
          : l
      )
    );
  }

  // -- Confirm all -----------------------------------------------------------

  async function handleConfirmAll() {
    setConfirming(true);
    const supabase = createClient();

    // Confirm all resolved items and mark statement as reconciled
    const allResolved = lines.every(
      (l) => l.match_status === "matched" || l.match_status === "excluded" || l.match_status === "manual"
    );

    if (!allResolved) {
      setError("Hay movimientos sin conciliar. Resuelva todos los items antes de confirmar.");
      setConfirming(false);
      return;
    }

    await supabase
      .from("bank_statements")
      .update({
        status: "reconciled",
        reconciled_at: new Date().toISOString(),
      })
      .eq("id", id);

    setStatement((prev) =>
      prev ? { ...prev, status: "reconciled" } : prev
    );
    setConfirming(false);
  }

  // -- Derived ---------------------------------------------------------------

  const matched = lines.filter(
    (l) => l.match_status === "matched" || l.match_status === "manual"
  ).length;
  const excluded = lines.filter((l) => l.match_status === "excluded").length;
  const pending = lines.filter((l) => l.match_status === "pending").length;
  const totalResolved = matched + excluded;
  const progressPct =
    lines.length > 0 ? Math.round((totalResolved / lines.length) * 100) : 0;

  usePageTransition(containerRef, { ready: !loading });

  // -- Render ----------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-muted-foreground">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        Cargando conciliacion...
      </div>
    );
  }

  if (!statement) {
    return (
      <div className="flex flex-col items-center gap-2 py-24 text-center">
        <AlertCircle className="h-5 w-5 text-muted-foreground/50" />
        <p className="text-[13px] font-medium">Extracto no encontrado</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-7 text-xs"
          onClick={() => router.push("/dashboard/reconciliation/list")}
        >
          <ArrowLeft className="mr-1.5 h-3 w-3" />
          Volver a listado
        </Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="anim-header flex items-end justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground"
              onClick={() => router.push("/dashboard/reconciliation/list")}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <GitCompareArrows className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-xl tracking-tight">
              Conciliacion &mdash; {statement.bank_name}
            </h2>
            <Badge variant="outline" className="text-[10px]">
              {statement.period}
            </Badge>
          </div>
          <p className="pl-9 text-[13px] text-muted-foreground">
            {statement.total_lines} movimientos &middot;{" "}
            {formatShortDate(new Date(statement.imported_at))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {statement.status !== "reconciled" && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleAutoMatch}
              disabled={matching || pending === 0}
            >
              {matching ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : (
                <Zap className="mr-1.5 h-3 w-3" />
              )}
              Auto-conciliar
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleConfirmAll}
            disabled={confirming || pending > 0 || statement.status === "reconciled"}
          >
            {confirming ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <Check className="mr-1.5 h-3 w-3" />
            )}
            {statement.status === "reconciled"
              ? "Conciliado"
              : "Confirmar conciliacion"}
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

      {/* Progress bar */}
      <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-[13px]">
            <div className="flex items-center gap-4">
              <span className="font-semibold">{progressPct}% conciliado</span>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                  {matched} conciliado(s)
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/30" />
                  {excluded} excluido(s)
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                  {pending} pendiente(s)
                </span>
              </div>
            </div>
            <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
              {totalResolved}/{lines.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Reconciliation table */}
      <Card className="anim-table">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="font-display text-sm">
            Movimientos del extracto
          </CardTitle>
          <CardDescription className="text-[11px]">
            Revise los matches propuestos, confirme o ajuste manualmente
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 pl-4 text-center text-[11px] font-medium uppercase tracking-wider">
                    Estado
                  </TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                    Fecha
                  </TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                    Desc. extracto
                  </TableHead>
                  <TableHead className="w-20 text-center text-[11px] font-medium uppercase tracking-wider">
                    Tipo
                  </TableHead>
                  <TableHead className="w-32 text-right text-[11px] font-medium uppercase tracking-wider">
                    Monto
                  </TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                    Match Kontabi
                  </TableHead>
                  <TableHead className="w-16 text-center text-[11px] font-medium uppercase tracking-wider">
                    Score
                  </TableHead>
                  <TableHead className="w-28 pr-4 text-right text-[11px] font-medium uppercase tracking-wider">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => {
                  const statusCfg = MATCH_STATUS_CFG[line.match_status];
                  const StatusIcon = statusCfg.icon;
                  const mr = line.matchResult;
                  const best = mr?.bestMatch;
                  const confCfg = best
                    ? CONFIDENCE_CFG[best.confidence]
                    : null;

                  return (
                    <TableRow
                      key={line.id}
                      className={
                        line.match_status === "excluded"
                          ? "opacity-40"
                          : line.match_status === "matched" || line.match_status === "manual"
                            ? "bg-emerald-500/[0.02]"
                            : best?.confidence === "high"
                              ? "bg-emerald-500/[0.03]"
                              : best?.confidence === "medium"
                                ? "bg-amber-500/[0.03]"
                                : ""
                      }
                    >
                      <TableCell className="pl-4 text-center">
                        <StatusIcon
                          className={`mx-auto h-3.5 w-3.5 ${statusCfg.color}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-[12px] tabular-nums text-muted-foreground">
                        {line.line_date}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-[13px]">
                        {line.description}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={
                            line.line_type === "credit"
                              ? "default"
                              : "outline"
                          }
                          className="text-[10px]"
                        >
                          {line.line_type === "credit"
                            ? "Credito"
                            : "Debito"}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-[13px] tabular-nums font-semibold ${
                          line.line_type === "credit"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-foreground"
                        }`}
                      >
                        {formatCOP(line.amount)}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-[12px] text-muted-foreground">
                        {line.match_status === "excluded" ? (
                          <span className="italic">Excluido</span>
                        ) : line.matchedTxDesc ? (
                          line.matchedTxDesc
                        ) : best ? (
                          <span className="text-muted-foreground/70">
                            Match sugerido ({best.score.toFixed(0)}%)
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">
                            Sin match
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {best && confCfg && (
                          <div className="flex items-center justify-center gap-1">
                            <span
                              className={`inline-block h-2 w-2 rounded-full ${confCfg.color}`}
                            />
                            <span className="font-mono text-[11px] tabular-nums">
                              {best.score.toFixed(0)}
                            </span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {line.match_status === "pending" && best && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-emerald-600 hover:text-emerald-700"
                              title="Confirmar match"
                              onClick={() =>
                                handleConfirmMatch(
                                  line.id,
                                  best.transactionId
                                )
                              }
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                          {line.match_status === "pending" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                              title="Excluir (comision, mov. interno)"
                              onClick={() => handleExclude(line.id)}
                            >
                              <Ban className="h-3 w-3" />
                            </Button>
                          )}
                          {(line.match_status === "matched" ||
                            line.match_status === "excluded" ||
                            line.match_status === "manual") &&
                            statement.status !== "reconciled" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                title="Revertir"
                                onClick={() => handleReset(line.id)}
                              >
                                <RotateCcw className="h-3 w-3" />
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
        </CardContent>
      </Card>
    </div>
  );
}
