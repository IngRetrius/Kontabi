"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePageTransition } from "@/hooks/use-page-transition";
import { createClient } from "@/lib/supabase/client";
import type {
  ReserveFund,
  ReserveFundMovement,
  AssemblyAct,
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
  Shield,
  Plus,
  Minus,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

// -- Status config -----------------------------------------------------------

const FUND_STATUS_MAP: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive"; dotClass: string }
> = {
  compliant: {
    label: "Cumple",
    variant: "default",
    dotClass: "bg-emerald-400 shadow-[0_0_6px_1px_rgba(52,211,153,.35)]",
  },
  below_minimum: {
    label: "Bajo minimo",
    variant: "secondary",
    dotClass: "bg-amber-400 shadow-[0_0_4px_1px_rgba(251,191,36,.3)]",
  },
  critical: {
    label: "Critico",
    variant: "destructive",
    dotClass: "bg-red-400 shadow-[0_0_4px_1px_rgba(248,113,113,.35)]",
  },
};

// -- Page --------------------------------------------------------------------

interface ActiveBudgetInfo {
  year: number;
  total: number;
  reserve_fund_pct: number;
}

export default function ReserveFundPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fund, setFund] = useState<ReserveFund | null>(null);
  const [movements, setMovements] = useState<ReserveFundMovement[]>([]);
  const [acts, setActs] = useState<AssemblyAct[]>([]);
  const [activeBudget, setActiveBudget] = useState<ActiveBudgetInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Movement dialog
  const [movOpen, setMovOpen] = useState(false);
  const [movType, setMovType] = useState<"contribution" | "withdrawal">(
    "contribution"
  );
  const [movAmount, setMovAmount] = useState("");
  const [movDesc, setMovDesc] = useState("");
  const [movActId, setMovActId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // -- Fetch -----------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const [fundRes, movRes, actsRes, budgetRes] = await Promise.all([
      supabase.from("reserve_fund").select("*").maybeSingle(),
      supabase
        .from("reserve_fund_movements")
        .select("*")
        .order("date", { ascending: false })
        .limit(50),
      supabase
        .from("assembly_acts")
        .select("id, act_number, date, description")
        .order("date", { ascending: false }),
      supabase
        .from("budgets")
        .select("year, total, reserve_fund_pct")
        .eq("status", "active")
        .maybeSingle(),
    ]);

    if (fundRes.data) setFund(fundRes.data as ReserveFund);
    setMovements((movRes.data ?? []) as ReserveFundMovement[]);
    setActs((actsRes.data ?? []) as AssemblyAct[]);
    setActiveBudget(budgetRes.data as ActiveBudgetInfo | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -- Create movement -------------------------------------------------------

  const handleSaveMovement = async () => {
    const amount = Number(movAmount);
    if (!amount || amount <= 0 || !movDesc.trim()) return;
    if (movType === "withdrawal" && !movActId) {
      setError("Los retiros requieren un acta de asamblea vinculada");
      return;
    }

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

    const { error: insertErr } = await supabase
      .from("reserve_fund_movements")
      .insert({
        tenant_id: uData.tenant_id,
        type: movType,
        amount,
        description: movDesc.trim(),
        assembly_act_id: movType === "withdrawal" ? movActId : null,
        date: new Date().toISOString().split("T")[0],
      });

    if (insertErr) {
      setError(insertErr.message);
      setSaving(false);
      return;
    }

    setMovOpen(false);
    setMovAmount("");
    setMovDesc("");
    setMovActId("");
    setSaving(false);
    await fetchData();
  };

  // -- Derived ---------------------------------------------------------------

  const st = fund ? FUND_STATUS_MAP[fund.status] : null;
  const compliancePct =
    fund && fund.legal_minimum > 0
      ? Math.round((fund.current_balance / fund.legal_minimum) * 100)
      : 0;

  usePageTransition(containerRef, { ready: !loading });

  // -- Render ----------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-muted-foreground">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        Cargando fondo de reserva...
      </div>
    );
  }

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="anim-header flex items-end justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-xl tracking-tight">
              Fondo de reserva
            </h2>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Art. 35 Ley 675 de 2001 &mdash; Minimo 1% del presupuesto anual
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setMovType("contribution");
              setMovOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-3 w-3" />
            Aporte
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setMovType("withdrawal");
              setMovOpen(true);
            }}
          >
            <Minus className="mr-1.5 h-3 w-3" />
            Retiro
          </Button>
        </div>
      </div>

      {/* Budget source banner */}
      {activeBudget ? (
        <div className="anim-banner flex items-center gap-3 rounded-md border border-border/60 bg-muted/30 px-4 py-2.5">
          <Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          <p className="text-[12px] text-muted-foreground">
            Minimo legal calculado como{" "}
            <span className="font-mono font-medium tabular-nums text-foreground">
              {fund?.budget_percentage ?? activeBudget.reserve_fund_pct}%
            </span>
            {" "}del presupuesto {activeBudget.year} ({formatCOP(activeBudget.total)})
            {" = "}
            <span className="font-mono font-medium tabular-nums text-foreground">
              {formatCOP(Math.round(activeBudget.total * (activeBudget.reserve_fund_pct / 100)))}
            </span>
          </p>
        </div>
      ) : (
        <div className="anim-banner flex items-center gap-2.5 rounded-md border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-[13px]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <p className="text-amber-600 dark:text-amber-400">
            No hay presupuesto activo. Activa un presupuesto para calcular el minimo legal del fondo de reserva.
          </p>
        </div>
      )}

      {/* Alert if below minimum */}
      {fund && fund.status !== "compliant" && (
        <div
          className={`flex items-start gap-2.5 rounded-md border px-4 py-2.5 text-[13px] ${
            fund.status === "critical"
              ? "border-red-500/20 bg-red-500/5"
              : "border-amber-500/20 bg-amber-500/5"
          }`}
        >
          <AlertTriangle
            className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
              fund.status === "critical" ? "text-red-500" : "text-amber-500"
            }`}
          />
          <div>
            <p
              className={`font-medium ${
                fund.status === "critical"
                  ? "text-red-600 dark:text-red-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {fund.status === "critical"
                ? "Saldo critico - por debajo del 50% del minimo legal"
                : "Saldo por debajo del minimo legal"}
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Se requiere un aporte de al menos{" "}
              {formatCOP(fund.legal_minimum - fund.current_balance)} para
              cumplir con la Ley 675.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="anim-banner flex items-center gap-2.5 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5">
              {st && (
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${st.dotClass}`}
                />
              )}
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Saldo actual
              </p>
            </div>
            <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {fund ? formatCOP(fund.current_balance) : "--"}
            </p>
            <div className="absolute -right-2 -top-2 h-14 w-14 rounded-full bg-foreground/[0.03]" />
          </CardContent>
        </Card>
        <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Minimo legal
            </p>
            <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {fund ? formatCOP(fund.legal_minimum) : "--"}
            </p>
          </CardContent>
        </Card>
        <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Cobertura
            </p>
            <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {compliancePct}%
            </p>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  compliancePct >= 100
                    ? "bg-emerald-400"
                    : compliancePct >= 50
                      ? "bg-amber-400"
                      : "bg-red-400"
                }`}
                style={{ width: `${Math.min(compliancePct, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Estado
            </p>
            {st ? (
              <Badge variant={st.variant} className="mt-1.5 gap-1.5 text-[11px]">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${st.dotClass}`}
                />
                {st.label}
              </Badge>
            ) : (
              <p className="mt-1.5 text-sm text-muted-foreground">Sin configurar</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Movements table */}
      <Card className="anim-table">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="font-display text-sm">
            Movimientos del fondo
          </CardTitle>
          <CardDescription className="text-[11px]">
            Aportes y retiros. Los retiros requieren acta de asamblea.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {movements.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-muted-foreground">
              Sin movimientos registrados
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-24 pl-4 text-[11px] font-medium uppercase tracking-wider">
                      Fecha
                    </TableHead>
                    <TableHead className="w-24 text-[11px] font-medium uppercase tracking-wider">
                      Tipo
                    </TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                      Descripcion
                    </TableHead>
                    <TableHead className="w-36 text-right pr-4 text-[11px] font-medium uppercase tracking-wider">
                      Monto
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((mov) => {
                    const isContribution = mov.type === "contribution";
                    return (
                      <TableRow key={mov.id}>
                        <TableCell className="pl-4 font-mono text-[12px] tabular-nums text-muted-foreground">
                          {new Date(mov.date + "T12:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {isContribution ? (
                              <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <ArrowDownRight className="h-3 w-3 text-red-500" />
                            )}
                            <span className="text-[13px]">
                              {isContribution ? "Aporte" : "Retiro"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-[13px] text-muted-foreground">
                          {mov.description}
                        </TableCell>
                        <TableCell
                          className={`pr-4 text-right font-mono text-[13px] font-semibold tabular-nums ${
                            isContribution ? "text-emerald-500" : "text-red-500"
                          }`}
                        >
                          {isContribution ? "+" : "-"}
                          {formatCOP(mov.amount)}
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

      {/* Movement dialog */}
      <Dialog open={movOpen} onOpenChange={setMovOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[15px]">
              {movType === "contribution"
                ? "Registrar aporte"
                : "Registrar retiro"}
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              {movType === "withdrawal"
                ? "Los retiros requieren un acta de asamblea vinculada (Art. 35 Ley 675)."
                : "Ingresa el monto y descripcion del aporte al fondo."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Monto
              </Label>
              <Input
                type="number"
                value={movAmount}
                onChange={(e) => setMovAmount(e.target.value)}
                className="h-8 font-mono text-[13px]"
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Descripcion
              </Label>
              <Textarea
                value={movDesc}
                onChange={(e) => setMovDesc(e.target.value)}
                rows={2}
                className="text-[13px]"
                placeholder={
                  movType === "contribution"
                    ? "Aporte mensual al fondo de reserva"
                    : "Justificacion del retiro"
                }
              />
            </div>
            {movType === "withdrawal" && (
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Acta de asamblea
                </Label>
                <Select value={movActId} onValueChange={(val) => setMovActId(val ?? "")}>
                  <SelectTrigger className="h-8 text-[13px]">
                    <SelectValue placeholder="Seleccionar acta..." />
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
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setMovOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={saving}
                onClick={handleSaveMovement}
              >
                {saving ? (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                ) : movType === "contribution" ? (
                  <Plus className="mr-1.5 h-3 w-3" />
                ) : (
                  <Minus className="mr-1.5 h-3 w-3" />
                )}
                Registrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
