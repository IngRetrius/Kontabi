"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { JournalEntry, JournalEntryLine, Account } from "@/types/database";
import { formatCOP, formatShortDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  AlertCircle,
  RefreshCw,
  Filter,
  X,
  CheckCircle2,
  Clock,
} from "lucide-react";

// -- Types -------------------------------------------------------------------

interface JournalEntryWithLines extends JournalEntry {
  lines: (JournalEntryLine & { account?: Pick<Account, "code" | "name"> })[];
}

const PAGE_SIZE = 20;

// -- Page Component ----------------------------------------------------------

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntryWithLines[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersVisible, setFiltersVisible] = useState(false);

  // -- Fetch -----------------------------------------------------------------

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("journal_entries")
      .select("*", { count: "exact" })
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterStatus) {
      query = query.eq("status", filterStatus);
    }
    if (dateFrom) {
      query = query.gte("date", dateFrom);
    }
    if (dateTo) {
      query = query.lte("date", dateTo);
    }
    if (searchQuery.trim()) {
      query = query.or(
        `description.ilike.%${searchQuery.trim()}%,entry_number.ilike.%${searchQuery.trim()}%`
      );
    }

    const { data, error: err, count } = await query;

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    // Map entries without lines initially
    const mapped: JournalEntryWithLines[] = ((data as JournalEntry[]) ?? []).map(
      (entry) => ({
        ...entry,
        lines: [],
      })
    );

    setEntries(mapped);
    setTotalCount(count ?? 0);
    setError(null);
    setLoading(false);
  }, [page, filterStatus, dateFrom, dateTo, searchQuery]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // -- Fetch lines for an entry when expanded --------------------------------

  async function fetchLines(entryId: string) {
    const supabase = createClient();

    const { data: lines } = await supabase
      .from("journal_entry_lines")
      .select("*, account:accounts(code, name)")
      .eq("journal_entry_id", entryId)
      .order("debit", { ascending: false });

    if (lines) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? {
                ...e,
                lines: lines as JournalEntryWithLines["lines"],
              }
            : e
        )
      );
    }
  }

  function handleRowClick(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      // Fetch lines if not already loaded
      const entry = entries.find((e) => e.id === id);
      if (entry && entry.lines.length === 0) {
        fetchLines(id);
      }
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasActiveFilters = searchQuery || filterStatus || dateFrom || dateTo;

  function clearFilters() {
    setSearchQuery("");
    setFilterStatus("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }

  // -- Loading ---------------------------------------------------------------

  if (loading && entries.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-56 animate-pulse rounded bg-muted" />
        <div className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-11 animate-pulse rounded-md bg-muted/20"
            />
          ))}
        </div>
      </div>
    );
  }

  // -- Render ----------------------------------------------------------------

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-sm">Libro diario</CardTitle>
              <CardDescription>
                {totalCount} asiento{totalCount !== 1 ? "s" : ""} contable
                {totalCount !== 1 ? "s" : ""}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiltersVisible(!filtersVisible)}
              >
                <Filter className="h-3.5 w-3.5" />
                Filtros
                {hasActiveFilters && (
                  <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    !
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={fetchEntries}
                title="Recargar"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Filters */}
          {filtersVisible && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border/60 bg-muted/20 p-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Numero o descripcion..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(0);
                    }}
                    className="w-52 pl-8"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Estado</Label>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setFilterStatus("");
                      setPage(0);
                    }}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      filterStatus === ""
                        ? "bg-foreground/10 text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => {
                      setFilterStatus("confirmed");
                      setPage(0);
                    }}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      filterStatus === "confirmed"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Confirmados
                  </button>
                  <button
                    onClick={() => {
                      setFilterStatus("draft");
                      setPage(0);
                    }}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      filterStatus === "draft"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Borradores
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Desde</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(0);
                  }}
                  className="w-36"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Hasta</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPage(0);
                  }}
                  className="w-36"
                />
              </div>

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground"
                >
                  <X className="h-3 w-3" />
                  Limpiar
                </Button>
              )}
            </div>
          )}

          {/* Table */}
          {entries.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <BookOpen className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  No hay asientos contables
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Los asientos se generan automaticamente al registrar
                  transacciones
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-8" />
                      <TableHead className="w-28">Numero</TableHead>
                      <TableHead className="w-24">Fecha</TableHead>
                      <TableHead>Descripcion</TableHead>
                      <TableHead className="w-20 text-center">
                        Estado
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.map((entry) => {
                      const isExpanded = expandedId === entry.id;

                      return (
                        <JournalEntryRow
                          key={entry.id}
                          entry={entry}
                          expanded={isExpanded}
                          onToggle={() => handleRowClick(entry.id)}
                        />
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-1">
                  <p className="text-xs text-muted-foreground">
                    Pagina {page + 1} de {totalPages}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-xs"
                      disabled={page === 0}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-xs"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage(page + 1)}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// -- Journal entry row -------------------------------------------------------

function JournalEntryRow({
  entry,
  expanded,
  onToggle,
}: {
  entry: JournalEntryWithLines;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isConfirmed = entry.status === "confirmed";

  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell className="w-8 pr-0">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-mono text-xs tabular-nums font-medium">
          {entry.entry_number}
        </TableCell>
        <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatShortDate(new Date(entry.date + "T00:00:00"))}
        </TableCell>
        <TableCell className="max-w-sm truncate">
          {entry.description}
        </TableCell>
        <TableCell className="text-center">
          {isConfirmed ? (
            <Badge
              variant="outline"
              className="border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
            >
              <CheckCircle2 className="mr-1 h-3 w-3" />
              OK
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400"
            >
              <Clock className="mr-1 h-3 w-3" />
              Borrador
            </Badge>
          )}
        </TableCell>
      </TableRow>

      {/* Expanded: journal entry lines */}
      {expanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={5} className="bg-muted/20 p-0">
            <div className="px-4 py-3">
              {entry.lines.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                  Cargando lineas...
                </div>
              ) : (
                <div className="rounded-md border bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="h-8 text-xs">Cuenta</TableHead>
                        <TableHead className="h-8 text-xs">
                          Descripcion
                        </TableHead>
                        <TableHead className="h-8 w-32 text-right text-xs">
                          Debito
                        </TableHead>
                        <TableHead className="h-8 w-32 text-right text-xs">
                          Credito
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entry.lines.map((line) => (
                        <TableRow
                          key={line.id}
                          className="hover:bg-transparent"
                        >
                          <TableCell className="py-1.5">
                            <span className="font-mono text-xs tabular-nums">
                              {line.account?.code ?? "---"}
                            </span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {line.account?.name ?? ""}
                            </span>
                          </TableCell>
                          <TableCell className="py-1.5 text-xs text-muted-foreground">
                            {line.description}
                          </TableCell>
                          <TableCell className="py-1.5 text-right font-mono text-xs tabular-nums">
                            {Number(line.debit) > 0 ? (
                              <span className="text-foreground">
                                {formatCOP(Number(line.debit))}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30">
                                --
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="py-1.5 text-right font-mono text-xs tabular-nums">
                            {Number(line.credit) > 0 ? (
                              <span className="text-foreground">
                                {formatCOP(Number(line.credit))}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30">
                                --
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals */}
                      <TableRow className="border-t hover:bg-transparent">
                        <TableCell
                          colSpan={2}
                          className="py-1.5 text-right text-xs font-medium"
                        >
                          Total
                        </TableCell>
                        <TableCell className="py-1.5 text-right font-mono text-xs font-semibold tabular-nums">
                          {formatCOP(
                            entry.lines.reduce(
                              (sum, l) => sum + Number(l.debit),
                              0
                            )
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 text-right font-mono text-xs font-semibold tabular-nums">
                          {formatCOP(
                            entry.lines.reduce(
                              (sum, l) => sum + Number(l.credit),
                              0
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
