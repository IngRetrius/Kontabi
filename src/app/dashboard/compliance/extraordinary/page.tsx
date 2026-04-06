"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePageTransition } from "@/hooks/use-page-transition";
import { createClient } from "@/lib/supabase/client";
import type {
  ExtraordinaryFee,
  ExtraordinaryFeeUnit,
  AssemblyAct,
  Unit,
} from "@/types/database";
import { formatCOP } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  CircleDollarSign,
  Plus,
  RefreshCw,
  AlertCircle,
  Loader2,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// -- Status config -----------------------------------------------------------

const FEE_STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline"; dotClass: string }
> = {
  active: {
    label: "Activa",
    variant: "default",
    dotClass: "bg-sky-400 shadow-[0_0_4px_1px_rgba(56,189,248,.3)]",
  },
  completed: {
    label: "Completada",
    variant: "secondary",
    dotClass: "bg-emerald-400",
  },
  cancelled: {
    label: "Cancelada",
    variant: "outline",
    dotClass: "bg-muted-foreground/50",
  },
};

// -- Page --------------------------------------------------------------------

export default function ExtraordinaryFeesPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fees, setFees] = useState<ExtraordinaryFee[]>([]);
  const [acts, setActs] = useState<AssemblyAct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [feeUnits, setFeeUnits] = useState<
    (ExtraordinaryFeeUnit & { unit?: { number: string } | null })[]
  >([]);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newConcept, setNewConcept] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDistribution, setNewDistribution] = useState<"coefficient" | "equal">(
    "coefficient"
  );
  const [newInstallments, setNewInstallments] = useState("1");
  const [newActId, setNewActId] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // -- Fetch -----------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const [feesRes, actsRes] = await Promise.all([
      supabase
        .from("extraordinary_fees")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("assembly_acts")
        .select("id, act_number, date, description")
        .order("date", { ascending: false }),
    ]);

    if (feesRes.error) setError(feesRes.error.message);
    else setFees((feesRes.data ?? []) as ExtraordinaryFee[]);

    setActs((actsRes.data ?? []) as AssemblyAct[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -- Expand fee units ------------------------------------------------------

  const handleExpand = async (feeId: string) => {
    if (expandedId === feeId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(feeId);
    const supabase = createClient();
    const { data } = await supabase
      .from("extraordinary_fee_units")
      .select("*, unit:units(number)")
      .eq("fee_id", feeId)
      .order("created_at");

    setFeeUnits(
      (data ?? []) as (ExtraordinaryFeeUnit & {
        unit?: { number: string } | null;
      })[]
    );
  };

  // -- Create fee + distribute -----------------------------------------------

  const handleCreate = async () => {
    const amount = Number(newAmount);
    const installments = Number(newInstallments) || 1;
    if (!newConcept.trim() || !amount || amount <= 0) return;

    setSaving(true);
    setError(null);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("No hay sesion activa");
      setSaving(false);
      return;
    }

    const { data: uData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_id", user.id)
      .single();
    if (!uData) {
      setError("Tenant no encontrado");
      setSaving(false);
      return;
    }

    const tenantId = uData.tenant_id;

    // Create fee
    const { data: fee, error: feeErr } = await supabase
      .from("extraordinary_fees")
      .insert({
        tenant_id: tenantId,
        concept: newConcept.trim(),
        total_amount: amount,
        distribution: newDistribution,
        start_date: new Date().toISOString().split("T")[0],
        installments,
        assembly_act_id: newActId || null,
        notes: newNotes.trim() || null,
      })
      .select()
      .single();

    if (feeErr || !fee) {
      setError(feeErr?.message ?? "Error creando cuota");
      setSaving(false);
      return;
    }

    // Get active units
    const { data: units } = await supabase
      .from("units")
      .select("id, coefficient")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    if (units && units.length > 0) {
      const totalCoeff = units.reduce((s, u) => s + u.coefficient, 0);
      const unitRows = units.map((u) => {
        const unitTotal =
          newDistribution === "coefficient"
            ? Math.round((amount * u.coefficient) / totalCoeff)
            : Math.round(amount / units.length);

        return {
          tenant_id: tenantId,
          fee_id: fee.id,
          unit_id: u.id,
          total_amount: unitTotal,
          installment_amount: Math.round(unitTotal / installments),
          balance: unitTotal,
        };
      });

      await supabase.from("extraordinary_fee_units").insert(unitRows);
    }

    setCreateOpen(false);
    setNewConcept("");
    setNewAmount("");
    setNewDistribution("coefficient");
    setNewInstallments("1");
    setNewActId("");
    setNewNotes("");
    setSaving(false);
    await fetchData();
  };

  // -- KPIs ------------------------------------------------------------------

  const activeFees = fees.filter((f) => f.status === "active");
  const totalActive = activeFees.reduce((s, f) => s + f.total_amount, 0);

  usePageTransition(containerRef, { ready: !loading });

  // -- Render ----------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="anim-header flex items-end justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-xl tracking-tight">
              Cuotas extraordinarias
            </h2>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Art. 29 Ley 675 &mdash; Requieren aprobacion de asamblea
          </p>
        </div>
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="mr-1.5 h-3 w-3" />
          Nueva cuota extraordinaria
        </Button>
      </div>

      {error && (
        <div className="anim-banner flex items-center gap-2.5 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Total registradas
            </p>
            <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {fees.length}
            </p>
            <div className="absolute -right-2 -top-2 h-14 w-14 rounded-full bg-foreground/[0.03]" />
          </CardContent>
        </Card>
        <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Activas
              </p>
            </div>
            <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {activeFees.length}
            </p>
          </CardContent>
        </Card>
        <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Monto activo total
            </p>
            <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight">
              {formatCOP(totalActive)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Fees list */}
      <Card className="anim-table">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="font-display text-sm">
            Cuotas registradas
          </CardTitle>
          <CardDescription className="text-[11px]">
            Haz clic en una cuota para ver la distribucion por unidad.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Cargando...
            </div>
          ) : fees.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border">
                <CircleDollarSign className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <p className="text-[13px] text-muted-foreground">
                Sin cuotas extraordinarias registradas
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4 text-[11px] font-medium uppercase tracking-wider">
                      Concepto
                    </TableHead>
                    <TableHead className="w-32 text-right text-[11px] font-medium uppercase tracking-wider">
                      Monto total
                    </TableHead>
                    <TableHead className="w-28 text-center text-[11px] font-medium uppercase tracking-wider">
                      Distribucion
                    </TableHead>
                    <TableHead className="w-20 text-center text-[11px] font-medium uppercase tracking-wider">
                      Cuotas
                    </TableHead>
                    <TableHead className="w-28 text-[11px] font-medium uppercase tracking-wider">
                      Estado
                    </TableHead>
                    <TableHead className="w-10 pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fees.map((fee) => {
                    const st = FEE_STATUS_MAP[fee.status];
                    const isExpanded = expandedId === fee.id;

                    return (
                      <>
                        <TableRow
                          key={fee.id}
                          className="cursor-pointer"
                          onClick={() => handleExpand(fee.id)}
                        >
                          <TableCell className="pl-4 text-[13px] font-medium">
                            {fee.concept}
                          </TableCell>
                          <TableCell className="text-right font-mono text-[13px] font-semibold tabular-nums">
                            {formatCOP(fee.total_amount)}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                              {fee.distribution === "coefficient"
                                ? "Coeficiente"
                                : "Partes iguales"}
                            </span>
                          </TableCell>
                          <TableCell className="text-center font-mono text-[13px] tabular-nums">
                            {fee.installments}
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
                          <TableCell className="pr-4">
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${fee.id}-detail`}>
                            <TableCell colSpan={6} className="bg-muted/30 p-0">
                              <div className="px-6 py-3">
                                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                                  Distribucion por unidad
                                </p>
                                <Table>
                                  <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                      <TableHead className="text-[11px]">
                                        Unidad
                                      </TableHead>
                                      <TableHead className="text-right text-[11px]">
                                        Total
                                      </TableHead>
                                      <TableHead className="text-right text-[11px]">
                                        Cuota/mes
                                      </TableHead>
                                      <TableHead className="text-right text-[11px]">
                                        Pagado
                                      </TableHead>
                                      <TableHead className="text-right text-[11px]">
                                        Saldo
                                      </TableHead>
                                      <TableHead className="text-[11px]">
                                        Estado
                                      </TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {feeUnits.map((fu) => (
                                      <TableRow key={fu.id}>
                                        <TableCell className="font-mono text-[12px] font-semibold">
                                          {fu.unit?.number ?? "--"}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-[12px] tabular-nums">
                                          {formatCOP(fu.total_amount)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-[12px] tabular-nums text-muted-foreground">
                                          {formatCOP(fu.installment_amount)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-[12px] tabular-nums text-emerald-500">
                                          {formatCOP(fu.paid_amount)}
                                        </TableCell>
                                        <TableCell className="text-right font-mono text-[12px] tabular-nums">
                                          {formatCOP(fu.balance)}
                                        </TableCell>
                                        <TableCell className="text-[12px] text-muted-foreground">
                                          {fu.status === "paid"
                                            ? "Pagado"
                                            : fu.status === "partial"
                                              ? "Parcial"
                                              : "Pendiente"}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[15px]">
              Nueva cuota extraordinaria
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              La cuota se distribuira automaticamente a todas las unidades
              activas segun el metodo seleccionado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Concepto
              </Label>
              <Input
                value={newConcept}
                onChange={(e) => setNewConcept(e.target.value)}
                className="h-8 text-[13px]"
                placeholder="Ej: Reparacion fachada"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Monto total
                </Label>
                <Input
                  type="number"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="h-8 font-mono text-[13px]"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Cuotas mensuales
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="60"
                  value={newInstallments}
                  onChange={(e) => setNewInstallments(e.target.value)}
                  className="h-8 font-mono text-[13px]"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Distribucion
              </Label>
              <Select
                value={newDistribution}
                onValueChange={(v) =>
                  setNewDistribution(v as "coefficient" | "equal")
                }
              >
                <SelectTrigger className="h-8 text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="coefficient" className="text-[12px]">
                    Por coeficiente de copropiedad
                  </SelectItem>
                  <SelectItem value="equal" className="text-[12px]">
                    Partes iguales
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Acta de asamblea (recomendado)
              </Label>
              <Select value={newActId} onValueChange={setNewActId}>
                <SelectTrigger className="h-8 text-[13px]">
                  <SelectValue placeholder="Sin acta vinculada" />
                </SelectTrigger>
                <SelectContent>
                  {acts.map((act) => (
                    <SelectItem
                      key={act.id}
                      value={act.id}
                      className="text-[12px]"
                    >
                      #{act.act_number} - {act.date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Notas
              </Label>
              <Textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                rows={2}
                className="text-[13px]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={saving}
                onClick={handleCreate}
              >
                {saving ? (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 h-3 w-3" />
                )}
                Crear y distribuir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
