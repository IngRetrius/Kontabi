"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePageTransition } from "@/hooks/use-page-transition";
import { formatPeriod } from "@/lib/utils/format";
import type { PeriodLock } from "@/types/database";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Lock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  CircleDot,
} from "lucide-react";

// -- Page --------------------------------------------------------------------

export default function PeriodLocksPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [locks, setLocks] = useState<PeriodLock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lock dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lockPeriod, setLockPeriod] = useState(() => {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [lockReason, setLockReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Checklist
  const [checkReconciliation, setCheckReconciliation] = useState(false);
  const [checkBalances, setCheckBalances] = useState(false);
  const [checkProvision, setCheckProvision] = useState(false);

  // -- Fetch -----------------------------------------------------------------

  const fetchLocks = useCallback(async () => {
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("period_locks")
      .select("*")
      .order("period", { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      setLocks((data ?? []) as PeriodLock[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLocks();
  }, [fetchLocks]);

  // -- Lock period -----------------------------------------------------------

  async function handleLockPeriod() {
    setSubmitting(true);
    setError(null);

    const supabase = createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("No hay sesion activa");
      setSubmitting(false);
      return;
    }

    const { data: appUser } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (!appUser) {
      setError("Usuario no encontrado");
      setSubmitting(false);
      return;
    }

    // Check if already locked
    const existing = locks.find((l) => l.period === lockPeriod);
    if (existing) {
      setError(`El periodo ${lockPeriod} ya esta cerrado`);
      setSubmitting(false);
      return;
    }

    // Insert lock
    const { error: lockErr } = await supabase.from("period_locks").insert({
      period: lockPeriod,
      locked_by: appUser.id,
      reason: lockReason || null,
      reconciliation_done: checkReconciliation,
      balances_verified: checkBalances,
      provision_calculated: checkProvision,
    });

    if (lockErr) {
      setError(`Error cerrando periodo: ${lockErr.message}`);
      setSubmitting(false);
      return;
    }

    // Update tenant_settings period_lock_date
    const [year, month] = lockPeriod.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const lockDate = `${lockPeriod}-${String(lastDay).padStart(2, "0")}`;

    await supabase.from("tenant_settings").upsert(
      { key: "period_lock_date", value: lockDate },
      { onConflict: "tenant_id,key" }
    );

    setDialogOpen(false);
    setLockReason("");
    setCheckReconciliation(false);
    setCheckBalances(false);
    setCheckProvision(false);
    setSubmitting(false);
    fetchLocks();
  }

  // -- Generate period options -----------------------------------------------

  function getAvailablePeriods(): string[] {
    const lockedPeriods = new Set(locks.map((l) => l.period));
    const periods: string[] = [];
    const now = new Date();

    for (let i = 1; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const p = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!lockedPeriods.has(p)) {
        periods.push(p);
      }
    }

    return periods;
  }

  const availablePeriods = getAvailablePeriods();
  const checklistComplete =
    checkReconciliation && checkBalances && checkProvision;

  usePageTransition(containerRef);

  // -- Render ----------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="anim-header flex items-end justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-xl tracking-tight">
              Bloqueo de periodos
            </h2>
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Cierre periodos contables para evitar modificaciones. Esta accion es
            irreversible desde la interfaz.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs text-muted-foreground"
            onClick={fetchLocks}
            disabled={loading}
          >
            <RefreshCw
              className={`mr-1.5 h-3 w-3 ${loading ? "animate-spin" : ""}`}
            />
            Recargar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button size="sm" className="h-8 text-xs" />}>
              <Lock className="mr-1.5 h-3 w-3" />
              Cerrar periodo
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-sm">
                  Cerrar periodo contable
                </DialogTitle>
                <DialogDescription className="text-[13px]">
                  Al cerrar un periodo, no se podran crear, modificar ni
                  eliminar transacciones con fecha dentro del mismo. Esta accion
                  es irreversible.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Period */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Periodo a cerrar
                  </Label>
                  <Input
                    type="month"
                    value={lockPeriod}
                    onChange={(e) => setLockPeriod(e.target.value)}
                    className="h-8 text-[13px]"
                  />
                </div>

                {/* Reason */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Motivo (opcional)
                  </Label>
                  <Input
                    value={lockReason}
                    onChange={(e) => setLockReason(e.target.value)}
                    placeholder="Cierre de mes ordinario..."
                    className="h-8 text-[13px]"
                  />
                </div>

                {/* Checklist */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Checklist pre-cierre
                  </Label>
                  <div className="space-y-2 rounded-md border p-3">
                    <label className="flex items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        checked={checkReconciliation}
                        onChange={(e) =>
                          setCheckReconciliation(e.target.checked)
                        }
                        className="h-3.5 w-3.5 rounded border-muted-foreground/30 accent-primary"
                      />
                      Conciliacion bancaria realizada
                    </label>
                    <label className="flex items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        checked={checkBalances}
                        onChange={(e) =>
                          setCheckBalances(e.target.checked)
                        }
                        className="h-3.5 w-3.5 rounded border-muted-foreground/30 accent-primary"
                      />
                      Saldos contables verificados
                    </label>
                    <label className="flex items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        checked={checkProvision}
                        onChange={(e) =>
                          setCheckProvision(e.target.checked)
                        }
                        className="h-3.5 w-3.5 rounded border-muted-foreground/30 accent-primary"
                      />
                      Provision de cartera calculada
                    </label>
                  </div>
                  {!checklistComplete && (
                    <p className="text-[11px] text-amber-500">
                      Complete todos los items del checklist antes de cerrar.
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={!checklistComplete || submitting}
                  onClick={handleLockPeriod}
                >
                  {submitting ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <Lock className="mr-1.5 h-3 w-3" />
                  )}
                  Cerrar periodo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Locks table */}
      <Card className="anim-card">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="font-display text-sm">
            Periodos cerrados
          </CardTitle>
          <CardDescription className="text-[11px]">
            Historial de periodos contables cerrados en el sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Cargando...
            </div>
          ) : locks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <CircleDot className="h-5 w-5 text-muted-foreground/50" />
              <p className="text-[13px] font-medium">
                Sin periodos cerrados
              </p>
              <p className="max-w-xs text-[12px] text-muted-foreground">
                Todos los periodos estan abiertos. Cierre un periodo cuando
                haya completado la conciliacion y verificacion de saldos.
              </p>
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
                      Cerrado el
                    </TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                      Motivo
                    </TableHead>
                    <TableHead className="text-center text-[11px] font-medium uppercase tracking-wider">
                      Conciliacion
                    </TableHead>
                    <TableHead className="text-center text-[11px] font-medium uppercase tracking-wider">
                      Saldos
                    </TableHead>
                    <TableHead className="pr-4 text-center text-[11px] font-medium uppercase tracking-wider">
                      Provision
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locks.map((lock) => (
                    <TableRow key={lock.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2">
                          <Lock className="h-3 w-3 text-muted-foreground/50" />
                          <span className="text-[13px] font-medium">
                            {formatPeriod(lock.period)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[12px] tabular-nums text-muted-foreground">
                        {new Date(lock.locked_at).toLocaleString("es-CO", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-[13px] text-muted-foreground">
                        {lock.reason || "\u2014"}
                      </TableCell>
                      <TableCell className="text-center">
                        {lock.reconciliation_done ? (
                          <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <span className="text-[11px] text-muted-foreground/40">
                            \u2014
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {lock.balances_verified ? (
                          <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <span className="text-[11px] text-muted-foreground/40">
                            \u2014
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="pr-4 text-center">
                        {lock.provision_calculated ? (
                          <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <span className="text-[11px] text-muted-foreground/40">
                            \u2014
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
