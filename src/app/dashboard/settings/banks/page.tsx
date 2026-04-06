"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePageTransition } from "@/hooks/use-page-transition";
import type { BankAccount, BankAccountType } from "@/types/database";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Landmark,
  Plus,
  RefreshCw,
  AlertCircle,
  Star,
  Trash2,
  Loader2,
} from "lucide-react";

// -- Constants ---------------------------------------------------------------

const BANK_OPTIONS = [
  "Bancolombia",
  "Davivienda",
  "BBVA Colombia",
  "Banco de Bogota",
  "Banco de Occidente",
  "Banco Popular",
  "Scotiabank Colpatria",
  "Banco Caja Social",
  "Otro",
];

const ACCOUNT_TYPES: { value: BankAccountType; label: string }[] = [
  { value: "corriente", label: "Corriente" },
  { value: "ahorros", label: "Ahorros" },
];

function mapBankAccountError(message: string): string {
  if (message.includes("bank_accounts_tenant_id_bank_name_account_number_key")) {
    return "Esta cuenta bancaria ya existe para el conjunto.";
  }
  return message;
}

// -- Page --------------------------------------------------------------------

export default function BanksSettingsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState<BankAccountType>("corriente");
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Settings
  const [dateTolerance, setDateTolerance] = useState("3");
  const [scoreThreshold, setScoreThreshold] = useState("40");

  // -- Fetch -----------------------------------------------------------------

  const fetchAccounts = useCallback(async () => {
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("is_active", true)
      .order("is_default", { ascending: false });

    // Fetch reconciliation settings
    const { data: settings } = await supabase
      .from("tenant_settings")
      .select("key, value")
      .in("key", ["reconciliation_date_tolerance", "reconciliation_score_threshold"]);

    return {
      accounts: (data ?? []) as BankAccount[],
      settings: settings ?? [],
      error: err?.message ?? null,
    };
  }, []);

  const reloadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await fetchAccounts();

    if (result.error) {
      setError(result.error);
    } else {
      setAccounts(result.accounts);
    }

    for (const s of result.settings) {
      if (s.key === "reconciliation_date_tolerance") setDateTolerance(s.value);
      if (s.key === "reconciliation_score_threshold") setScoreThreshold(s.value);
    }

    setLoading(false);
  }, [fetchAccounts]);

  useEffect(() => {
    let cancelled = false;

    void fetchAccounts().then((result) => {
      if (cancelled) return;

      if (result.error) {
        setError(result.error);
      } else {
        setAccounts(result.accounts);
      }

      for (const s of result.settings) {
        if (s.key === "reconciliation_date_tolerance") setDateTolerance(s.value);
        if (s.key === "reconciliation_score_threshold") setScoreThreshold(s.value);
      }

      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [fetchAccounts]);

  // -- Add account -----------------------------------------------------------

  async function handleAddAccount() {
    const normalizedBankName = bankName.trim();
    const normalizedAccountNumber = accountNumber.trim();
    if (!normalizedBankName || !normalizedAccountNumber) return;

    setSubmitting(true);
    setError(null);

    const supabase = createClient();

    const { data: existing, error: existingErr } = await supabase
      .from("bank_accounts")
      .select("id")
      .eq("bank_name", normalizedBankName)
      .eq("account_number", normalizedAccountNumber)
      .maybeSingle();

    if (existingErr) {
      setError(mapBankAccountError(existingErr.message));
      setSubmitting(false);
      return;
    }

    // If setting as default, unset other defaults first
    if (isDefault || accounts.length === 0) {
      await supabase
        .from("bank_accounts")
        .update({ is_default: false })
        .eq("is_default", true);
    }

    let err: { message: string } | null = null;

    if (existing) {
      const { error: updateErr } = await supabase
        .from("bank_accounts")
        .update({
          account_type: accountType,
          is_default: isDefault || accounts.length === 0,
          is_active: true,
        })
        .eq("id", existing.id);
      err = updateErr;
    } else {
      const { error: insertErr } = await supabase.from("bank_accounts").insert({
        bank_name: normalizedBankName,
        account_number: normalizedAccountNumber,
        account_type: accountType,
        is_default: isDefault || accounts.length === 0,
      });
      err = insertErr;
    }

    if (err) {
      setError(mapBankAccountError(err.message));
    } else {
      setDialogOpen(false);
      setBankName("");
      setAccountNumber("");
      setAccountType("corriente");
      setIsDefault(false);
      await reloadAccounts();
    }
    setSubmitting(false);
  }

  // -- Delete account --------------------------------------------------------

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase
      .from("bank_accounts")
      .update({ is_active: false })
      .eq("id", id);
    await reloadAccounts();
  }

  // -- Set default -----------------------------------------------------------

  async function handleSetDefault(id: string) {
    const supabase = createClient();
    await supabase
      .from("bank_accounts")
      .update({ is_default: false })
      .eq("is_default", true);
    await supabase
      .from("bank_accounts")
      .update({ is_default: true })
      .eq("id", id);
    await reloadAccounts();
  }

  // -- Save settings ---------------------------------------------------------

  async function handleSaveSettings() {
    const supabase = createClient();
    await supabase.from("tenant_settings").upsert([
      { key: "reconciliation_date_tolerance", value: dateTolerance },
      { key: "reconciliation_score_threshold", value: scoreThreshold },
    ], { onConflict: "tenant_id,key" });
  }

  usePageTransition(containerRef);

  // -- Render ----------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="anim-header flex items-end justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-xl tracking-tight">
              Configuracion bancaria
            </h2>
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Registre las cuentas bancarias del conjunto y configure las reglas
            de conciliacion automatica.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button size="sm" className="h-8 text-xs" />}>
            <Plus className="mr-1.5 h-3 w-3" />
            Agregar cuenta
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-sm">
                Nueva cuenta bancaria
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Banco
                </Label>
                <Select value={bankName} onValueChange={(v) => setBankName(v ?? "")}>
                  <SelectTrigger className="h-8 text-[13px]">
                    <SelectValue placeholder="Seleccionar banco..." />
                  </SelectTrigger>
                  <SelectContent>
                    {BANK_OPTIONS.map((b) => (
                      <SelectItem key={b} value={b} className="text-[13px]">
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Numero de cuenta
                </Label>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="000-000000-00"
                  className="h-8 font-mono text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Tipo de cuenta
                </Label>
                <Select
                  value={accountType}
                  onValueChange={(v) => v && setAccountType(v as BankAccountType)}
                >
                  <SelectTrigger className="h-8 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((t) => (
                      <SelectItem
                        key={t.value}
                        value={t.value}
                        className="text-[13px]"
                      >
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-muted-foreground/30 accent-primary"
                />
                Cuenta principal
              </label>
            </div>
            <DialogFooter>
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={!bankName || !accountNumber || submitting}
                onClick={handleAddAccount}
              >
                {submitting && (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                )}
                Agregar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Accounts table */}
      <Card className="anim-card">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="font-display text-sm">
            Cuentas bancarias
          </CardTitle>
          <CardDescription className="text-[11px]">
            Cuentas registradas para conciliacion de extractos
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-[13px] text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Cargando...
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Landmark className="h-5 w-5 text-muted-foreground/50" />
              <p className="text-[13px] font-medium">Sin cuentas registradas</p>
              <p className="text-[12px] text-muted-foreground">
                Agregue al menos una cuenta bancaria para iniciar conciliaciones.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4 text-[11px] font-medium uppercase tracking-wider">
                    Banco
                  </TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                    Numero
                  </TableHead>
                  <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                    Tipo
                  </TableHead>
                  <TableHead className="w-20 text-center text-[11px] font-medium uppercase tracking-wider">
                    Principal
                  </TableHead>
                  <TableHead className="w-20 pr-4 text-right text-[11px] font-medium uppercase tracking-wider">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="pl-4 text-[13px] font-medium">
                      {acc.bank_name}
                    </TableCell>
                    <TableCell className="font-mono text-[13px] text-muted-foreground">
                      {acc.account_number}
                    </TableCell>
                    <TableCell className="text-[13px] capitalize text-muted-foreground">
                      {acc.account_type}
                    </TableCell>
                    <TableCell className="text-center">
                      {acc.is_default ? (
                        <Star className="mx-auto h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground/40 hover:text-amber-400"
                          onClick={() => handleSetDefault(acc.id)}
                          title="Establecer como principal"
                        >
                          <Star className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(acc.id)}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reconciliation settings */}
      <Card className="anim-card">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="font-display text-sm">
            Reglas de conciliacion
          </CardTitle>
          <CardDescription className="text-[11px]">
            Configuracion del motor de cruce automatico
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Tolerancia de fecha (dias)
              </Label>
              <Input
                type="number"
                min={0}
                max={15}
                value={dateTolerance}
                onChange={(e) => setDateTolerance(e.target.value)}
                className="h-8 font-mono text-[13px]"
              />
              <p className="text-[11px] text-muted-foreground/60">
                Rango de dias para considerar coincidencia de fecha
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Umbral minimo de score
              </Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={scoreThreshold}
                onChange={(e) => setScoreThreshold(e.target.value)}
                className="h-8 font-mono text-[13px]"
              />
              <p className="text-[11px] text-muted-foreground/60">
                Score minimo (0-100) para sugerir un match
              </p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={handleSaveSettings}
            >
              Guardar reglas
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
