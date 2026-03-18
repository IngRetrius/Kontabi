"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import type {
  Transaction,
  TransactionType,
  TransactionNarratives,
} from "@/types/database";
import {
  TRANSACTION_CATEGORIES,
  getTransactionLabel,
  getMapping,
} from "@/lib/accounting/mappings";
import {
  createTransaction,
  type CreateTransactionInput,
} from "@/lib/accounting/engine";
import { useNLS } from "@/hooks/use-nls";
import { formatCOP, formatShortDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
  Plus,
  Search,
  ChevronDown,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  BookOpen,
  Eye,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

// -- Constants ---------------------------------------------------------------

const INCOME_TYPES: TransactionType[] = [
  "quota_payment",
  "extraordinary_payment",
  "late_interest",
  "common_area_rental",
  "other_income",
];

const PAGE_SIZE = 20;

// -- Schema ------------------------------------------------------------------

const transactionSchema = z.object({
  type: z.string().min(1, "Selecciona un tipo"),
  amount: z.string().min(1, "El monto es requerido"),
  date: z.string().min(1, "La fecha es requerida"),
  description: z.string().min(1, "La descripcion es requerida"),
  unitId: z.string().optional(),
  supplier: z.string().optional(),
  period: z.string().optional(),
  reference: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

// -- Helpers -----------------------------------------------------------------

function isIncomeType(type: TransactionType): boolean {
  return INCOME_TYPES.includes(type);
}

function getTypeMetadataFields(
  type: string
): Array<{ key: string; label: string; placeholder: string }> {
  switch (type) {
    case "quota_payment":
    case "extraordinary_payment":
      return [
        {
          key: "period",
          label: "Periodo",
          placeholder: "2026-03",
        },
      ];
    case "supplier_payment":
      return [
        {
          key: "supplier",
          label: "Proveedor",
          placeholder: "Nombre del proveedor",
        },
      ];
    case "late_interest":
      return [
        {
          key: "period",
          label: "Periodo",
          placeholder: "2026-03",
        },
      ];
    default:
      return [];
  }
}

function parseAmount(value: string): number {
  return Number(value.replace(/[^0-9]/g, "")) || 0;
}

// -- Page Component ----------------------------------------------------------

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [narrativeLevel, setNarrativeLevel] = useState<
    "detail" | "accounting"
  >("detail");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersVisible, setFiltersVisible] = useState(false);

  // -- Fetch -----------------------------------------------------------------

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("transactions")
      .select("*", { count: "exact" })
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (filterType) {
      query = query.eq("type", filterType);
    }
    if (dateFrom) {
      query = query.gte("date", dateFrom);
    }
    if (dateTo) {
      query = query.lte("date", dateTo);
    }
    if (searchQuery.trim()) {
      query = query.ilike("description", `%${searchQuery.trim()}%`);
    }

    const { data, error: err, count } = await query;

    if (err) {
      setError(err.message);
    } else {
      setTransactions((data as Transaction[]) ?? []);
      setTotalCount(count ?? 0);
      setError(null);
    }
    setLoading(false);
  }, [page, filterType, dateFrom, dateTo, searchQuery]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // -- Stats -----------------------------------------------------------------

  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      if (isIncomeType(tx.type)) {
        income += Number(tx.amount);
      } else {
        expense += Number(tx.amount);
      }
    }
    return { income, expense, net: income - expense };
  }, [transactions]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // -- Handlers --------------------------------------------------------------

  function handleRowClick(id: string) {
    setExpandedId(expandedId === id ? null : id);
    setNarrativeLevel("detail");
  }

  function clearFilters() {
    setSearchQuery("");
    setFilterType("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  }

  const hasActiveFilters = searchQuery || filterType || dateFrom || dateTo;

  // -- Loading ---------------------------------------------------------------

  if (loading && transactions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-56 animate-pulse rounded bg-muted" />
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[72px] animate-pulse rounded-lg bg-muted/40 ring-1 ring-foreground/5"
            />
          ))}
        </div>
        <div className="h-10 animate-pulse rounded-lg bg-muted/30" />
        <div className="space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
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

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1 rounded-lg bg-emerald-500/5 px-4 py-3 ring-1 ring-emerald-500/10">
          <p className="text-xs text-muted-foreground">Ingresos</p>
          <p className="font-mono text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCOP(stats.income)}
          </p>
        </div>
        <div className="space-y-1 rounded-lg bg-rose-500/5 px-4 py-3 ring-1 ring-rose-500/10">
          <p className="text-xs text-muted-foreground">Gastos</p>
          <p className="font-mono text-xl font-semibold tabular-nums text-rose-600 dark:text-rose-400">
            {formatCOP(stats.expense)}
          </p>
        </div>
        <div className="space-y-1 rounded-lg bg-muted/40 px-4 py-3 ring-1 ring-foreground/5">
          <p className="text-xs text-muted-foreground">Neto</p>
          <p
            className={`font-mono text-xl font-semibold tabular-nums ${
              stats.net >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {formatCOP(stats.net)}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-sm">Transacciones</CardTitle>
              <CardDescription>
                {totalCount} registro{totalCount !== 1 ? "s" : ""} encontrado
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
                onClick={fetchTransactions}
                title="Recargar"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Nueva transaccion
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Filters bar */}
          {filtersVisible && (
            <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border/60 bg-muted/20 p-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Descripcion..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPage(0);
                    }}
                    className="w-48 pl-8"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo</Label>
                <Select
                  value={filterType}
                  onValueChange={(val) => {
                    setFilterType(val as string);
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos los tipos</SelectItem>
                    {Object.entries(TRANSACTION_CATEGORIES).map(
                      ([key, category]) => (
                        <SelectGroup key={key}>
                          <SelectLabel>{category.label}</SelectLabel>
                          {category.types.map((t) => (
                            <SelectItem key={t.type} value={t.type}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )
                    )}
                  </SelectContent>
                </Select>
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
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <BookOpen className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  No hay transacciones registradas
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Registra la primera transaccion para comenzar a llevar la
                  contabilidad
                </p>
              </div>
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Nueva transaccion
              </Button>
            </div>
          ) : (
            <>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-24">Fecha</TableHead>
                      <TableHead className="w-40">Tipo</TableHead>
                      <TableHead>Descripcion</TableHead>
                      <TableHead className="w-36 text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => {
                      const income = isIncomeType(tx.type);
                      const isExpanded = expandedId === tx.id;
                      const narratives =
                        tx.narratives as TransactionNarratives | null;

                      return (
                        <TransactionRow
                          key={tx.id}
                          tx={tx}
                          income={income}
                          expanded={isExpanded}
                          narrativeLevel={narrativeLevel}
                          narratives={narratives}
                          onToggle={() => handleRowClick(tx.id)}
                          onLevelChange={setNarrativeLevel}
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

      {/* New transaction dialog */}
      <NewTransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => {
          fetchTransactions();
          setDialogOpen(false);
        }}
      />
    </div>
  );
}

// -- Transaction row (with expandable detail) --------------------------------

function TransactionRow({
  tx,
  income,
  expanded,
  narrativeLevel,
  narratives,
  onToggle,
  onLevelChange,
}: {
  tx: Transaction;
  income: boolean;
  expanded: boolean;
  narrativeLevel: "detail" | "accounting";
  narratives: TransactionNarratives | null;
  onToggle: () => void;
  onLevelChange: (level: "detail" | "accounting") => void;
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={onToggle}
      >
        <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatShortDate(new Date(tx.date + "T00:00:00"))}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded ${
                income
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              }`}
            >
              {income ? (
                <ArrowDownLeft className="h-3 w-3" />
              ) : (
                <ArrowUpRight className="h-3 w-3" />
              )}
            </span>
            <span className="text-xs">{getTransactionLabel(tx.type)}</span>
          </div>
        </TableCell>
        <TableCell className="max-w-xs truncate text-muted-foreground">
          {narratives?.summary ?? tx.description}
        </TableCell>
        <TableCell
          className={`text-right font-mono tabular-nums ${
            income
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {income ? "+" : "-"}
          {formatCOP(Number(tx.amount))}
        </TableCell>
      </TableRow>

      {/* Expanded detail */}
      {expanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={4} className="bg-muted/20 p-0">
            <div className="space-y-3 px-4 py-3">
              {/* Level toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLevelChange("detail");
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    narrativeLevel === "detail"
                      ? "bg-foreground/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Detalle
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLevelChange("accounting");
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    narrativeLevel === "accounting"
                      ? "bg-foreground/10 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Contable
                </button>
              </div>

              {/* Narrative */}
              <div className="rounded-md border border-border/50 bg-background px-3 py-2.5">
                <p className="text-sm leading-relaxed">
                  {narrativeLevel === "detail"
                    ? narratives?.detail
                    : narratives?.accounting}
                  {!narratives && (
                    <span className="text-muted-foreground italic">
                      Narrativa no disponible
                    </span>
                  )}
                </p>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                <span>
                  Asiento:{" "}
                  <span className="font-mono text-foreground">
                    {tx.journal_entry_id
                      ? tx.journal_entry_id.slice(0, 8)
                      : "---"}
                  </span>
                </span>
                <span>
                  Creado:{" "}
                  {formatShortDate(new Date(tx.created_at))}
                </span>
                {tx.unit_id && (
                  <span>
                    Unidad:{" "}
                    <span className="text-foreground">
                      {tx.unit_id.slice(0, 8)}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// -- New transaction dialog --------------------------------------------------

function NewTransactionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const nls = useNLS();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      description: "",
      unitId: "",
      supplier: "",
      period: "",
      reference: "",
    },
  });

  const watchedType = watch("type");
  const watchedAmount = watch("amount");
  const watchedDescription = watch("description");
  const watchedSupplier = watch("supplier");
  const watchedPeriod = watch("period");
  const watchedUnitId = watch("unitId");

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      reset({
        type: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        description: "",
        unitId: "",
        supplier: "",
        period: "",
        reference: "",
      });
      setSubmitError(null);
      nls.reset();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate NLS preview when form changes
  useEffect(() => {
    if (!watchedType || !watchedAmount) return;

    const amount = parseAmount(watchedAmount);
    if (amount <= 0) return;

    const timer = setTimeout(() => {
      nls.generate(watchedType as TransactionType, {
        amount: formatCOP(amount),
        concept: watchedDescription || undefined,
        supplier: watchedSupplier || undefined,
        period: watchedPeriod || undefined,
        unit: watchedUnitId || undefined,
        account_debit: mapping?.debitCode
          ? `${mapping.debitCode}`
          : undefined,
        account_credit: mapping?.creditCode
          ? `${mapping.creditCode}`
          : undefined,
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [watchedType, watchedAmount, watchedDescription, watchedSupplier, watchedPeriod, watchedUnitId]); // eslint-disable-line react-hooks/exhaustive-deps

  const mapping = watchedType
    ? getMapping(watchedType as TransactionType)
    : null;
  const metadataFields = getTypeMetadataFields(watchedType);

  async function onSubmit(data: TransactionFormData) {
    setIsSubmitting(true);
    setSubmitError(null);

    const amount = parseAmount(data.amount);
    const metadata: Record<string, unknown> = {};
    if (data.supplier) metadata.supplier = data.supplier;
    if (data.period) metadata.period = data.period;
    if (data.reference) metadata.reference = data.reference;
    if (data.unitId) metadata.unit_label = data.unitId;

    const input: CreateTransactionInput = {
      type: data.type as TransactionType,
      amount,
      date: data.date,
      description: data.description,
      unitId: data.unitId || undefined,
      metadata,
    };

    const result = await createTransaction(input);

    setIsSubmitting(false);

    if (result.error) {
      setSubmitError(result.error);
      return;
    }

    onCreated();
  }

  const previewAmount = parseAmount(watchedAmount || "0");
  const isIncome = watchedType
    ? isIncomeType(watchedType as TransactionType)
    : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva transaccion</DialogTitle>
          <DialogDescription>
            Registra un movimiento financiero. El asiento contable se genera
            automaticamente.
          </DialogDescription>
        </DialogHeader>

        {submitError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Left: Form fields */}
            <div className="space-y-3">
              {/* Type */}
              <div className="space-y-1.5">
                <Label htmlFor="tx-type">Tipo de operacion</Label>
                <Select
                  value={watchedType}
                  onValueChange={(val) =>
                    setValue("type", val as string, { shouldValidate: true })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRANSACTION_CATEGORIES).map(
                      ([key, category]) => (
                        <SelectGroup key={key}>
                          <SelectLabel>{category.label}</SelectLabel>
                          {category.types.map((t) => (
                            <SelectItem key={t.type} value={t.type}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )
                    )}
                  </SelectContent>
                </Select>
                {errors.type && (
                  <p className="text-xs text-destructive">
                    {errors.type.message}
                  </p>
                )}
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <Label htmlFor="tx-amount">Monto (COP)</Label>
                <Input
                  id="tx-amount"
                  placeholder="0"
                  className="font-mono"
                  {...register("amount")}
                  aria-invalid={!!errors.amount}
                />
                {previewAmount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formatCOP(previewAmount)}
                  </p>
                )}
                {errors.amount && (
                  <p className="text-xs text-destructive">
                    {errors.amount.message}
                  </p>
                )}
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <Label htmlFor="tx-date">Fecha</Label>
                <Input
                  id="tx-date"
                  type="date"
                  {...register("date")}
                  aria-invalid={!!errors.date}
                />
                {errors.date && (
                  <p className="text-xs text-destructive">
                    {errors.date.message}
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="tx-desc">Descripcion</Label>
                <Textarea
                  id="tx-desc"
                  placeholder="Descripcion del movimiento"
                  rows={2}
                  className="resize-none"
                  {...register("description")}
                  aria-invalid={!!errors.description}
                />
                {errors.description && (
                  <p className="text-xs text-destructive">
                    {errors.description.message}
                  </p>
                )}
              </div>

              {/* Unit (optional) */}
              <div className="space-y-1.5">
                <Label htmlFor="tx-unit">
                  Unidad{" "}
                  <span className="text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  id="tx-unit"
                  placeholder="Ej: Apto 301 Torre A"
                  {...register("unitId")}
                />
              </div>

              {/* Dynamic metadata fields */}
              {metadataFields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={`tx-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`tx-${field.key}`}
                    placeholder={field.placeholder}
                    {...register(
                      field.key as keyof TransactionFormData
                    )}
                  />
                </div>
              ))}
            </div>

            {/* Right: Preview panel */}
            <div className="space-y-3">
              {/* Journal entry preview */}
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Asiento contable
                </p>
                {mapping && previewAmount > 0 ? (
                  <div className="space-y-2">
                    {/* Debit */}
                    <div className="flex items-center gap-2 rounded-md bg-background px-2.5 py-1.5 ring-1 ring-foreground/5">
                      <Badge
                        variant="outline"
                        className="shrink-0 font-mono text-[10px]"
                      >
                        DB
                      </Badge>
                      <span className="min-w-0 truncate text-xs">
                        {mapping.debitCode}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatCOP(previewAmount)}
                      </span>
                    </div>
                    {/* Arrow */}
                    <div className="flex justify-center">
                      <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                    </div>
                    {/* Credit */}
                    <div className="flex items-center gap-2 rounded-md bg-background px-2.5 py-1.5 ring-1 ring-foreground/5">
                      <Badge
                        variant="outline"
                        className="shrink-0 font-mono text-[10px]"
                      >
                        CR
                      </Badge>
                      <span className="min-w-0 truncate text-xs">
                        {mapping.creditCode}
                      </span>
                      <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-rose-600 dark:text-rose-400">
                        {formatCOP(previewAmount)}
                      </span>
                    </div>
                    {/* Balance check */}
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Partida doble balanceada
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Selecciona tipo y monto para ver el asiento
                  </p>
                )}
              </div>

              {/* NLS preview */}
              <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Narrativa NLS
                </p>
                {nls.narratives ? (
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                        Resumen
                      </p>
                      <p className="rounded-md bg-background px-2.5 py-1.5 text-xs ring-1 ring-foreground/5">
                        {nls.narratives.summary}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                        Detalle
                      </p>
                      <p className="rounded-md bg-background px-2.5 py-1.5 text-xs ring-1 ring-foreground/5">
                        {nls.narratives.detail}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                        Contable
                      </p>
                      <p className="rounded-md bg-background px-2.5 py-1.5 text-xs font-mono ring-1 ring-foreground/5">
                        {nls.narratives.accounting}
                      </p>
                    </div>
                  </div>
                ) : nls.loading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                    Generando narrativa...
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    Completa el formulario para ver la narrativa
                  </p>
                )}
              </div>

              {/* Mapping description */}
              {mapping && (
                <div className="flex items-start gap-2 rounded-md border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                  <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{mapping.description}</span>
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-2 border-t pt-4">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Registrando...
                </span>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Registrar transaccion
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
