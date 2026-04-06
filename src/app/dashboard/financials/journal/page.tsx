"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePageTransition } from "@/hooks/use-page-transition";
import type { JournalEntry, JournalEntryLine } from "@/types/database";
import { formatCOP, formatShortDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
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
  BookOpen,
  Search,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  FileText,
  Printer,
  CheckCircle2,
  XCircle,
  List,
  LayoutList,
} from "lucide-react";

// -- Types -------------------------------------------------------------------

interface AccountInfo {
  id: string;
  code: string;
  name: string;
}

interface EntryLineWithAccount extends JournalEntryLine {
  account: AccountInfo;
}

interface JournalEntryWithLines extends JournalEntry {
  lines: EntryLineWithAccount[];
  totalDebit: number;
  totalCredit: number;
}

type ViewMode = "entries" | "ledger";

// -- Constants ---------------------------------------------------------------

const PAGE_SIZE = 25;

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// -- Helpers -----------------------------------------------------------------

function buildPeriodOptions(): { value: string; label: string }[] {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    options.push({ value, label });
  }
  return options;
}

function getPeriodLabel(period: string, options: { value: string; label: string }[]): string {
  return options.find((o) => o.value === period)?.label ?? period;
}

// -- Page Component ----------------------------------------------------------

export default function JournalPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [entries, setEntries] = useState<JournalEntryWithLines[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());

  // Filters
  const [period, setPeriod] = useState(currentPeriod);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("entries");
  const [showDrafts, setShowDrafts] = useState(false);

  // Pagination (only for entries view)
  const [page, setPage] = useState(0);

  const periodOptions = useMemo(buildPeriodOptions, []);

  // -- Fetch -----------------------------------------------------------------

  const fetchEntries = useCallback(async () => {
    setError(null);
    const supabase = createClient();

    const [year, month] = period.split("-").map(Number);
    const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0);
    const endStr = `${year}-${String(month).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

    // Fetch journal entries for the period
    let query = supabase
      .from("journal_entries")
      .select("*")
      .gte("date", startStr)
      .lte("date", endStr)
      .order("date", { ascending: true })
      .order("entry_number", { ascending: true });

    if (!showDrafts) {
      query = query.eq("status", "confirmed");
    }

    if (searchQuery.trim()) {
      query = query.or(
        `description.ilike.%${searchQuery.trim()}%,entry_number.ilike.%${searchQuery.trim()}%`
      );
    }

    const { data: journalEntries, error: jeErr } = await query;

    if (jeErr) {
      setError(jeErr.message);
      setLoading(false);
      return;
    }

    if (!journalEntries || journalEntries.length === 0) {
      setEntries([]);
      setLoading(false);
      return;
    }

    // Fetch lines for all entries
    const entryIds = journalEntries.map((e) => e.id);
    const allLines: EntryLineWithAccount[] = [];

    const BATCH_SIZE = 200;
    for (let i = 0; i < entryIds.length; i += BATCH_SIZE) {
      const batch = entryIds.slice(i, i + BATCH_SIZE);
      const { data: lines, error: linesErr } = await supabase
        .from("journal_entry_lines")
        .select(`
          id,
          journal_entry_id,
          account_id,
          debit,
          credit,
          description,
          created_at,
          account:accounts!inner(id, code, name)
        `)
        .in("journal_entry_id", batch)
        .order("debit", { ascending: false });

      if (linesErr) {
        setError(linesErr.message);
        setLoading(false);
        return;
      }

      if (lines) {
        for (const line of lines as Array<Record<string, unknown>>) {
          allLines.push({
            id: line.id as string,
            journal_entry_id: line.journal_entry_id as string,
            account_id: line.account_id as string,
            debit: Number(line.debit),
            credit: Number(line.credit),
            description: line.description as string | null,
            created_at: line.created_at as string,
            account: line.account as AccountInfo,
          });
        }
      }
    }

    // Group lines by entry
    const linesByEntry = new Map<string, EntryLineWithAccount[]>();
    for (const line of allLines) {
      const existing = linesByEntry.get(line.journal_entry_id) ?? [];
      existing.push(line);
      linesByEntry.set(line.journal_entry_id, existing);
    }

    // Build combined entries (chronological ascending)
    const combined: JournalEntryWithLines[] = (journalEntries as JournalEntry[]).map((entry) => {
      const lines = linesByEntry.get(entry.id) ?? [];
      // Sort: debits first (convention), then by account code
      lines.sort((a, b) => {
        if (Number(a.debit) > 0 && Number(b.debit) === 0) return -1;
        if (Number(a.debit) === 0 && Number(b.debit) > 0) return 1;
        return a.account.code.localeCompare(b.account.code);
      });

      const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit), 0);
      const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit), 0);

      return { ...entry, lines, totalDebit, totalCredit };
    });

    setEntries(combined);
    setLoading(false);
  }, [period, showDrafts, searchQuery]);

  useEffect(() => {
    setLoading(true);
    setPage(0);
    fetchEntries();
  }, [fetchEntries]);

  // -- Refresh ---------------------------------------------------------------

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEntries();
    setRefreshing(false);
  };

  // -- Expand/collapse (entries view) ----------------------------------------

  const toggleEntry = (id: string) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedEntries(new Set(paginatedEntries.map((e) => e.id)));
  };

  const collapseAll = () => {
    setExpandedEntries(new Set());
  };

  // -- Computed values -------------------------------------------------------

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const paginatedEntries = viewMode === "entries"
    ? entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : entries;

  // Period-level sums (only confirmed entries count for sumas iguales)
  const confirmedEntries = entries.filter((e) => e.status === "confirmed");
  const periodDebitTotal = confirmedEntries.reduce((s, e) => s + e.totalDebit, 0);
  const periodCreditTotal = confirmedEntries.reduce((s, e) => s + e.totalCredit, 0);
  const sumasIguales = Math.abs(periodDebitTotal - periodCreditTotal) < 0.01;
  const draftCount = entries.filter((e) => e.status === "draft").length;

  const handlePrint = () => window.print();

  usePageTransition(containerRef, { ready: !(loading && entries.length === 0) });

  // -- Loading ---------------------------------------------------------------

  if (loading && entries.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-56 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/20" />
          ))}
        </div>
        <div className="h-10 animate-pulse rounded-lg bg-muted/30" />
        <div className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-muted/15" />
          ))}
        </div>
      </div>
    );
  }

  // -- Render ----------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-5 print:space-y-3">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-sm text-destructive print:hidden">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Header */}
      <div className="anim-header flex items-end justify-between gap-4 print:hidden">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-xl tracking-tight">
              Libro diario
            </h2>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Registro cronologico de asientos contables -- partida doble
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={handlePrint}
          >
            <Printer className="mr-1.5 h-3 w-3" />
            Imprimir
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-1.5 h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block print:text-center print:pb-2 print:border-b">
        <h1 className="text-lg font-bold">Libro Diario Oficial</h1>
        <p className="text-sm text-muted-foreground">
          Periodo: {getPeriodLabel(period, periodOptions)}
        </p>
        {showDrafts && (
          <p className="text-xs text-amber-600">Incluye asientos en borrador</p>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 anim-kpi print:grid-cols-4 print:gap-2">
        <KpiCard
          label="Asientos del periodo"
          value={String(confirmedEntries.length)}
          sub={draftCount > 0 && showDrafts ? `+ ${draftCount} borradores` : undefined}
          colorClass="text-foreground"
          borderClass="border-border"
        />
        <KpiCard
          label="Total debitos"
          value={formatCOP(periodDebitTotal)}
          colorClass="text-sky-600 dark:text-sky-400"
          borderClass="border-sky-500/20"
        />
        <KpiCard
          label="Total creditos"
          value={formatCOP(periodCreditTotal)}
          colorClass="text-violet-600 dark:text-violet-400"
          borderClass="border-violet-500/20"
        />
        <Card className={`relative overflow-hidden ${sumasIguales ? "border-emerald-500/20" : "border-destructive/30"}`}>
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Sumas iguales
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              {sumasIguales ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className={`font-mono text-sm font-semibold tabular-nums ${sumasIguales ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {sumasIguales
                  ? "Cuadrado"
                  : `Dif: ${formatCOP(Math.abs(periodDebitTotal - periodCreditTotal))}`}
              </span>
            </div>
            <p className="mt-1 font-mono text-[10px] tabular-nums text-muted-foreground/60">
              Debitos = Creditos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="anim-filter print:hidden">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Periodo
            </Label>
            <Select value={period} onValueChange={(v) => { if (v) setPeriod(v); }}>
              <SelectTrigger className="h-8 w-48 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-[13px]">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Vista
            </Label>
            <div className="flex items-center gap-0.5 rounded-lg bg-muted p-[3px]">
              <button
                onClick={() => setViewMode("entries")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  viewMode === "entries"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutList className="h-3 w-3" />
                Asientos
              </button>
              <button
                onClick={() => setViewMode("ledger")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  viewMode === "ledger"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="h-3 w-3" />
                Libro oficial
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Buscar
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="No. asiento o descripcion..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-56 pl-8 text-[13px]"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showDrafts}
                onChange={(e) => setShowDrafts(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border"
              />
              <span className="text-[12px] text-muted-foreground">
                Incluir borradores
              </span>
            </label>

            {viewMode === "entries" && (
              <>
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={expandAll}>
                  Expandir todo
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={collapseAll}>
                  Colapsar todo
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Empty state */}
      {entries.length === 0 ? (
        <div className="anim-card flex flex-col items-center gap-3 py-16 print:hidden">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
            <FileText className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">
              No se encontraron asientos contables
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              No hay asientos confirmados para {getPeriodLabel(period, periodOptions)}
            </p>
          </div>
        </div>
      ) : viewMode === "ledger" ? (
        /* ================================================================== */
        /*  LIBRO OFICIAL -- Vista continua (formato clasico de libro diario) */
        /* ================================================================== */
        <Card className="anim-table overflow-hidden print:border-none print:shadow-none">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/30 print:bg-transparent">
                  <TableHead className="w-24 pl-4 text-[11px] uppercase tracking-wider">
                    Fecha
                  </TableHead>
                  <TableHead className="w-20 text-[11px] uppercase tracking-wider">
                    Asiento
                  </TableHead>
                  <TableHead className="w-24 text-[11px] uppercase tracking-wider">
                    Codigo
                  </TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider">
                    Cuenta y detalle
                  </TableHead>
                  <TableHead className="w-32 text-right text-[11px] uppercase tracking-wider">
                    Debe
                  </TableHead>
                  <TableHead className="w-32 pr-4 text-right text-[11px] uppercase tracking-wider">
                    Haber
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry, entryIdx) => (
                  <LedgerEntryRows
                    key={entry.id}
                    entry={entry}
                    showDrafts={showDrafts}
                    isLast={entryIdx === entries.length - 1}
                  />
                ))}

                {/* Period totals -- Sumas iguales */}
                <TableRow className="border-t-2 border-foreground/20 bg-muted/40 hover:bg-muted/50 print:bg-transparent print:font-bold">
                  <TableCell colSpan={4} className="pl-4 py-3 text-[12px] font-bold uppercase tracking-wide">
                    Sumas iguales del periodo -- {getPeriodLabel(period, periodOptions)}
                  </TableCell>
                  <TableCell className="py-3 text-right font-mono text-[13px] font-bold tabular-nums">
                    {formatCOP(periodDebitTotal)}
                  </TableCell>
                  <TableCell className="pr-4 py-3 text-right font-mono text-[13px] font-bold tabular-nums">
                    {formatCOP(periodCreditTotal)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        /* ================================================================== */
        /*  ASIENTOS -- Vista por tarjetas expandibles                        */
        /* ================================================================== */
        <>
          <div className="anim-card space-y-2">
            {paginatedEntries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                expanded={expandedEntries.has(entry.id)}
                onToggle={() => toggleEntry(entry.id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="anim-fade flex items-center justify-between px-1">
              <p className="text-xs text-muted-foreground">
                Mostrando {page * PAGE_SIZE + 1}
                -{Math.min((page + 1) * PAGE_SIZE, entries.length)}{" "}
                de {entries.length} asientos
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                </Button>
                <span className="px-2 text-xs tabular-nums text-muted-foreground">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Period verification footer */}
      {entries.length > 0 && (
        <Card className="anim-fade border-dashed print:border-solid">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Verificacion del periodo
                </p>
                <p className="font-mono text-[12px] tabular-nums text-muted-foreground">
                  {confirmedEntries.length} asientos confirmados
                  {draftCount > 0 && showDrafts ? ` + ${draftCount} borradores` : ""}
                </p>
              </div>
              <div className="text-right space-y-0.5">
                <p className="font-mono text-[13px] tabular-nums">
                  <span className="text-muted-foreground mr-2">Debe:</span>
                  <span className="text-sky-600 dark:text-sky-400">{formatCOP(periodDebitTotal)}</span>
                  <span className="mx-3 text-muted-foreground">=</span>
                  <span className="text-muted-foreground mr-2">Haber:</span>
                  <span className="text-violet-600 dark:text-violet-400">{formatCOP(periodCreditTotal)}</span>
                </p>
                <div className="flex items-center justify-end gap-1.5">
                  {sumasIguales ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-destructive" />
                  )}
                  <span className={`text-[12px] font-medium ${sumasIguales ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    {sumasIguales ? "Sumas iguales verificadas" : `Diferencia: ${formatCOP(Math.abs(periodDebitTotal - periodCreditTotal))}`}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// -- KPI Card ----------------------------------------------------------------

function KpiCard({
  label,
  value,
  sub,
  colorClass,
  borderClass,
}: {
  label: string;
  value: string;
  sub?: string;
  colorClass: string;
  borderClass: string;
}) {
  return (
    <Card className={`relative overflow-hidden ${borderClass}`}>
      <CardContent className="p-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {label}
        </p>
        <p className={`mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight ${colorClass}`}>
          {value}
        </p>
        {sub && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400">{sub}</p>
        )}
        <div className="absolute -right-2 -top-2 h-14 w-14 rounded-full bg-foreground/[0.03]" />
      </CardContent>
    </Card>
  );
}

// -- Ledger Entry Rows (continuous table view) --------------------------------

function LedgerEntryRows({
  entry,
  showDrafts,
  isLast,
}: {
  entry: JournalEntryWithLines;
  showDrafts: boolean;
  isLast: boolean;
}) {
  const isDraft = entry.status === "draft";

  return (
    <>
      {/* Entry header row: date, number, glosa */}
      <TableRow className={`border-t hover:bg-transparent ${isDraft ? "opacity-60" : ""}`}>
        <TableCell className="pl-4 py-2 align-top font-mono text-[12px] tabular-nums text-muted-foreground">
          {formatShortDate(new Date(entry.date + "T00:00:00"))}
        </TableCell>
        <TableCell className="py-2 align-top font-mono text-[12px] font-semibold tabular-nums">
          {entry.entry_number}
        </TableCell>
        <TableCell colSpan={4} className="pr-4 py-2 align-top">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium">
              {entry.description}
            </span>
            {isDraft && showDrafts && (
              <Badge
                variant="outline"
                className="text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]"
              >
                Borrador
              </Badge>
            )}
          </div>
        </TableCell>
      </TableRow>

      {/* Line rows */}
      {entry.lines.map((line) => {
        const isCredit = Number(line.credit) > 0;
        return (
          <TableRow
            key={line.id}
            className={`border-none hover:bg-muted/20 ${isDraft ? "opacity-60" : ""}`}
          >
            <TableCell className="pl-4 py-1" />
            <TableCell className="py-1" />
            <TableCell className="py-1 font-mono text-[11px] tabular-nums text-muted-foreground/70">
              {line.account.code}
            </TableCell>
            <TableCell className="py-1">
              <span className={`text-[12px] ${isCredit ? "pl-6 text-muted-foreground" : ""}`}>
                {line.account.name}
              </span>
            </TableCell>
            <TableCell className="py-1 text-right font-mono text-[12px] tabular-nums">
              {Number(line.debit) > 0 ? formatCOP(Number(line.debit)) : ""}
            </TableCell>
            <TableCell className="pr-4 py-1 text-right font-mono text-[12px] tabular-nums">
              {Number(line.credit) > 0 ? formatCOP(Number(line.credit)) : ""}
            </TableCell>
          </TableRow>
        );
      })}

      {/* Entry subtotal */}
      <TableRow className={`border-none hover:bg-transparent ${isDraft ? "opacity-60" : ""}`}>
        <TableCell colSpan={4} className="py-1" />
        <TableCell className="py-1 text-right">
          <span className="inline-block w-full border-t border-foreground/20 pt-0.5 font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
            {formatCOP(entry.totalDebit)}
          </span>
        </TableCell>
        <TableCell className="pr-4 py-1 text-right">
          <span className="inline-block w-full border-t border-foreground/20 pt-0.5 font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
            {formatCOP(entry.totalCredit)}
          </span>
        </TableCell>
      </TableRow>

      {/* Spacer between entries (except last) */}
      {!isLast && (
        <TableRow className="border-none hover:bg-transparent">
          <TableCell colSpan={6} className="py-1" />
        </TableRow>
      )}
    </>
  );
}

// -- Entry Card (expandable view) --------------------------------------------

function EntryCard({
  entry,
  expanded,
  onToggle,
}: {
  entry: JournalEntryWithLines;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isBalanced = Math.abs(entry.totalDebit - entry.totalCredit) < 0.01;
  const isDraft = entry.status === "draft";

  return (
    <Card className={isDraft ? "border-dashed" : ""}>
      {/* Header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}

        <div className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-mono text-[13px] font-semibold tabular-nums">
            {entry.entry_number}
          </span>
          <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
            {formatShortDate(new Date(entry.date + "T00:00:00"))}
          </span>
          {isDraft && (
            <Badge
              variant="outline"
              className="text-amber-600 dark:text-amber-400 border-amber-500/30"
            >
              Borrador
            </Badge>
          )}
          <span className="text-[13px] text-muted-foreground truncate max-w-md">
            {entry.description}
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <span className="font-mono text-[13px] font-medium tabular-nums">
            {formatCOP(entry.totalDebit)}
          </span>
          {!isBalanced && (
            <AlertCircle className="h-3.5 w-3.5 text-destructive" />
          )}
        </div>
      </button>

      {/* Lines table */}
      {expanded && (
        <CardContent className="border-t bg-muted/10 px-0 pb-0 pt-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-11 text-[11px] uppercase tracking-wider">
                  Cuenta
                </TableHead>
                <TableHead className="text-[11px] uppercase tracking-wider">
                  Detalle
                </TableHead>
                <TableHead className="text-right text-[11px] uppercase tracking-wider">
                  Debe
                </TableHead>
                <TableHead className="pr-4 text-right text-[11px] uppercase tracking-wider">
                  Haber
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entry.lines.map((line) => (
                <TableRow key={line.id} className="hover:bg-muted/30">
                  <TableCell className="pl-11 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
                        {line.account.code}
                      </span>
                      <span className={`text-[12px] ${Number(line.credit) > 0 ? "pl-4" : ""}`}>
                        {line.account.name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2 text-[12px] text-muted-foreground">
                    {line.description ?? ""}
                  </TableCell>
                  <TableCell className="py-2 text-right font-mono text-[12px] tabular-nums">
                    {Number(line.debit) > 0 ? formatCOP(Number(line.debit)) : ""}
                  </TableCell>
                  <TableCell className="pr-4 py-2 text-right font-mono text-[12px] tabular-nums">
                    {Number(line.credit) > 0 ? formatCOP(Number(line.credit)) : ""}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 bg-muted/20 hover:bg-muted/30 font-semibold">
                <TableCell colSpan={2} className="pl-11 py-2 text-[12px] uppercase tracking-wide text-muted-foreground">
                  Sumas iguales
                </TableCell>
                <TableCell className="py-2 text-right font-mono text-[12px] tabular-nums">
                  {formatCOP(entry.totalDebit)}
                </TableCell>
                <TableCell className="pr-4 py-2 text-right font-mono text-[12px] tabular-nums">
                  {formatCOP(entry.totalCredit)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}
