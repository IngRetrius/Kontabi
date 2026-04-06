"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePageTransition } from "@/hooks/use-page-transition";
import { createClient } from "@/lib/supabase/client";
import type { Invoice, InvoiceStatus, PaymentMethod } from "@/types/database";
import { registerPayment } from "@/lib/accounting/payments";
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
  Receipt,
  CreditCard,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Banknote,
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

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "transfer", label: "Transferencia" },
  { value: "deposit", label: "Consignacion" },
  { value: "cash", label: "Efectivo" },
  { value: "other", label: "Otro" },
];

// -- Types -------------------------------------------------------------------

interface UnitOption {
  id: string;
  unit_number: string;
  tower: string | null;
}

interface UnitRaw {
  id: string;
  number: string;
  building: { name: string }[] | { name: string } | null;
}

interface InvoiceRow extends Invoice {
  selected: boolean;
}

// -- Page --------------------------------------------------------------------

export default function RegisterPaymentPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Units
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");

  // Invoices
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Payment form
  const [amount, setAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("transfer");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  // State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    paymentId: string;
    applied: number;
    surplus: number;
  } | null>(null);

  // -- Fetch units -----------------------------------------------------------

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("units")
        .select("id, number, building:buildings(name)")
        .eq("is_active", true)
        .order("number");
      const mapped: UnitOption[] = ((data ?? []) as UnitRaw[]).map((u) => {
        const bld = Array.isArray(u.building) ? u.building[0] : u.building;
        return {
          id: u.id,
          unit_number: u.number,
          tower: bld?.name ?? null,
        };
      });
      setUnits(mapped);
    }
    load();
  }, []);

  // -- Fetch invoices for selected unit --------------------------------------

  const fetchInvoices = useCallback(async (unitId: string) => {
    setLoadingInvoices(true);
    setError(null);
    const supabase = createClient();

    const { data, error: err } = await supabase
      .from("invoices")
      .select("*")
      .eq("unit_id", unitId)
      .in("status", ["pending", "partial", "overdue"])
      .order("period", { ascending: true });

    if (err) {
      setError(err.message);
      setInvoices([]);
    } else {
      setInvoices(
        (data ?? []).map((inv) => ({ ...inv, selected: false } as InvoiceRow))
      );
    }
    setLoadingInvoices(false);
  }, []);

  useEffect(() => {
    if (selectedUnitId) {
      fetchInvoices(selectedUnitId);
      setSuccess(null);
      setAmount(0);
    } else {
      setInvoices([]);
    }
  }, [selectedUnitId, fetchInvoices]);

  // -- Derived state ---------------------------------------------------------

  const selectedInvoices = useMemo(
    () => invoices.filter((i) => i.selected),
    [invoices]
  );

  const totalOutstanding = useMemo(
    () =>
      selectedInvoices.reduce((s, i) => s + (i.total - i.paid_amount), 0),
    [selectedInvoices]
  );

  const surplus = useMemo(
    () => Math.max(0, amount - totalOutstanding),
    [amount, totalOutstanding]
  );

  const shortfall = useMemo(
    () => Math.max(0, totalOutstanding - amount),
    [amount, totalOutstanding]
  );

  // -- Handlers --------------------------------------------------------------

  function toggleInvoice(invoiceId: string) {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId ? { ...inv, selected: !inv.selected } : inv
      )
    );
  }

  function toggleAll(checked: boolean) {
    setInvoices((prev) => prev.map((inv) => ({ ...inv, selected: checked })));
  }

  function autoFillAmount() {
    setAmount(totalOutstanding);
  }

  async function handleSubmit() {
    if (!selectedUnitId) return;
    if (selectedInvoices.length === 0) {
      setError("Seleccione al menos un cobro");
      return;
    }
    if (amount <= 0) {
      setError("El monto debe ser mayor a cero");
      return;
    }

    setSubmitting(true);
    setError(null);

    const result = await registerPayment({
      unitId: selectedUnitId,
      invoiceIds: selectedInvoices.map((i) => i.id),
      amount,
      paymentDate,
      paymentMethod,
      reference: reference || undefined,
      notes: notes || undefined,
    });

    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    setSuccess({
      paymentId: result.paymentId!,
      applied: result.appliedInvoices.length,
      surplus: result.surplus,
    });
    setSubmitting(false);

    // Refresh invoice list
    fetchInvoices(selectedUnitId);
    setAmount(0);
    setReference("");
    setNotes("");
  }

  usePageTransition(containerRef);

  // -- Render ----------------------------------------------------------------

  const selectedUnit = units.find((u) => u.id === selectedUnitId);
  const allSelected =
    invoices.length > 0 && invoices.every((i) => i.selected);

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="anim-header space-y-0.5">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-xl tracking-tight">
            Registrar pago
          </h2>
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Seleccione la unidad, los cobros a pagar y registre el comprobante.
          El asiento contable se genera automaticamente.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2.5 rounded-md border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-[13px] text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>
            Pago registrado exitosamente. {success.applied} cobro(s) aplicado(s).
            {success.surplus > 0 && ` Saldo a favor: ${formatCOP(success.surplus)}.`}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 text-[11px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            onClick={() => router.push(`/dashboard/payments/unit/${selectedUnitId}`)}
          >
            Ver estado de cuenta
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left: Unit + invoices */}
        <div className="space-y-4">
          {/* Unit selector */}
          <Card className="anim-card">
            <CardHeader className="border-b px-4 py-3">
              <CardTitle className="font-display text-sm">
                Unidad
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Seleccionar unidad
                </Label>
                <Select
                  value={selectedUnitId}
                  onValueChange={(v) => setSelectedUnitId(v)}
                >
                  <SelectTrigger className="h-8 text-[13px]">
                    <SelectValue placeholder="Seleccionar unidad..." />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem
                        key={u.id}
                        value={u.id}
                        className="text-[13px]"
                      >
                        {u.unit_number}
                        {u.tower ? ` - Torre ${u.tower}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Invoices list */}
          {selectedUnitId && (
            <Card className="anim-table">
              <CardHeader className="border-b px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-display text-sm">
                      Cobros pendientes
                    </CardTitle>
                    <CardDescription className="text-[11px]">
                      {selectedUnit
                        ? `Unidad ${selectedUnit.unit_number}`
                        : ""}
                      {" "}&mdash; {invoices.length} cobro(s) encontrado(s)
                    </CardDescription>
                  </div>
                  {invoices.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] text-muted-foreground"
                      onClick={autoFillAmount}
                      disabled={selectedInvoices.length === 0}
                    >
                      Auto-llenar monto
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingInvoices ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Cargando cobros...
                  </div>
                ) : invoices.length === 0 ? (
                  <div className="flex flex-col items-center gap-1.5 py-12 text-center">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <p className="text-[13px] font-medium">
                      Sin cobros pendientes
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Esta unidad esta al dia.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-10 pl-4">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={(e) => toggleAll(e.target.checked)}
                              className="h-3.5 w-3.5 rounded border-muted-foreground/30 accent-primary"
                            />
                          </TableHead>
                          <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                            Periodo
                          </TableHead>
                          <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                            Estado
                          </TableHead>
                          <TableHead className="w-28 text-right text-[11px] font-medium uppercase tracking-wider">
                            Cuota
                          </TableHead>
                          <TableHead className="w-24 text-right text-[11px] font-medium uppercase tracking-wider">
                            Extra
                          </TableHead>
                          <TableHead className="w-24 text-right text-[11px] font-medium uppercase tracking-wider">
                            Mora
                          </TableHead>
                          <TableHead className="w-28 text-right text-[11px] font-medium uppercase tracking-wider">
                            Total
                          </TableHead>
                          <TableHead className="w-28 text-right pr-4 text-[11px] font-medium uppercase tracking-wider">
                            Saldo
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((inv) => {
                          const outstanding = inv.total - inv.paid_amount;
                          const cfg = STATUS_MAP[inv.status];
                          return (
                            <TableRow
                              key={inv.id}
                              className={
                                inv.selected
                                  ? "bg-primary/[0.03]"
                                  : undefined
                              }
                            >
                              <TableCell className="pl-4">
                                <input
                                  type="checkbox"
                                  checked={inv.selected}
                                  onChange={() => toggleInvoice(inv.id)}
                                  className="h-3.5 w-3.5 rounded border-muted-foreground/30 accent-primary"
                                />
                              </TableCell>
                              <TableCell className="text-[13px] font-medium">
                                {formatPeriod(inv.period)}
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
                              <TableCell className="text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                                {formatCOP(inv.quota_amount)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                                {inv.extraordinary_amount > 0
                                  ? formatCOP(inv.extraordinary_amount)
                                  : "\u2014"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                                {inv.late_fee_amount > 0
                                  ? formatCOP(inv.late_fee_amount)
                                  : "\u2014"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-[13px] tabular-nums">
                                {formatCOP(inv.total)}
                              </TableCell>
                              <TableCell
                                className={`pr-4 text-right font-mono text-[13px] tabular-nums font-semibold ${
                                  outstanding > 0
                                    ? "text-amber-500"
                                    : "text-emerald-500"
                                }`}
                              >
                                {formatCOP(outstanding)}
                              </TableCell>
                            </TableRow>
                          );
                        })}

                        {/* Totals row */}
                        {selectedInvoices.length > 0 && (
                          <TableRow className="border-t-2 border-border bg-muted/30 font-semibold hover:bg-muted/30">
                            <TableCell className="pl-4" />
                            <TableCell
                              colSpan={6}
                              className="text-[13px]"
                            >
                              {selectedInvoices.length} seleccionado(s)
                            </TableCell>
                            <TableCell className="pr-4 text-right font-mono text-[13px] tabular-nums text-amber-500">
                              {formatCOP(totalOutstanding)}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Payment details */}
        <div className="space-y-4">
          <Card className="anim-card">
            <CardHeader className="border-b px-4 py-3">
              <CardTitle className="font-display text-sm">
                Datos del pago
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              {/* Amount */}
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Monto
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="1"
                    min={0}
                    value={amount || ""}
                    onChange={(e) =>
                      setAmount(Number(e.target.value) || 0)
                    }
                    className="h-8 pl-7 font-mono text-[13px] tabular-nums"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Fecha de pago
                </Label>
                <Input
                  type="date"
                  value={paymentDate}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="h-8 text-[13px]"
                />
              </div>

              {/* Method */}
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Metodo de pago
                </Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(v) =>
                    setPaymentMethod(v as PaymentMethod)
                  }
                >
                  <SelectTrigger className="h-8 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem
                        key={m.value}
                        value={m.value}
                        className="text-[13px]"
                      >
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reference */}
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Referencia / comprobante
                </Label>
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Numero de transferencia..."
                  className="h-8 text-[13px]"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Notas
                </Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observaciones opcionales..."
                  className="h-8 text-[13px]"
                />
              </div>

              {/* Receipt upload placeholder */}
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Comprobante
                </Label>
                <div className="flex flex-col items-center gap-1.5 rounded-md border border-dashed border-muted-foreground/25 bg-muted/20 px-4 py-5 text-center transition-colors hover:border-muted-foreground/40 hover:bg-muted/30">
                  <Upload className="h-4 w-4 text-muted-foreground/50" />
                  <p className="text-[11px] text-muted-foreground/70">
                    Arrastre o haga clic para subir
                  </p>
                  <p className="text-[10px] text-muted-foreground/40">
                    PDF, JPG o PNG (max 5MB)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary strip */}
          {selectedInvoices.length > 0 && (
            <Card className="relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1 bg-primary/60" />
              <CardContent className="space-y-2.5 p-4 pl-5">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Resumen
                </p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">
                      Total seleccionado
                    </span>
                    <span className="font-mono tabular-nums font-semibold">
                      {formatCOP(totalOutstanding)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">
                      Monto a pagar
                    </span>
                    <span className="font-mono tabular-nums font-semibold">
                      {formatCOP(amount)}
                    </span>
                  </div>
                  <div className="h-px bg-border" />
                  {surplus > 0 && (
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Saldo a favor
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                        +{formatCOP(surplus)}
                      </span>
                    </div>
                  )}
                  {shortfall > 0 && (
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-amber-500">
                        Pendiente despues de pago
                      </span>
                      <span className="font-mono tabular-nums font-semibold text-amber-500">
                        {formatCOP(shortfall)}
                      </span>
                    </div>
                  )}
                  {surplus === 0 && shortfall === 0 && amount > 0 && (
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Pago exacto
                      </span>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submit */}
          <Button
            className="h-9 w-full text-[13px]"
            disabled={
              !selectedUnitId ||
              selectedInvoices.length === 0 ||
              amount <= 0 ||
              submitting
            }
            onClick={handleSubmit}
          >
            {submitting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Banknote className="mr-1.5 h-3.5 w-3.5" />
            )}
            Registrar pago
          </Button>
        </div>
      </div>
    </div>
  );
}
