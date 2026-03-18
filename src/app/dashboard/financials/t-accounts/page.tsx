"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Account } from "@/types/database";
import { formatCOP, formatShortDate } from "@/lib/utils/format";
import {
  TAccount,
  type TAccountData,
  type TAccountMovement,
  type TAccountViewLevel,
} from "@/components/financials/t-account";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Columns3,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

// -- Types -------------------------------------------------------------------

interface AccountOption {
  id: string;
  code: string;
  name: string;
  accountType: string;
  nature: "debito" | "credito";
}

// -- Page Component ----------------------------------------------------------

export default function TAccountsPage() {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [tAccountData, setTAccountData] = useState<TAccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewLevel, setViewLevel] = useState<TAccountViewLevel>("simple");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // -- Fetch accounts --------------------------------------------------------

  const fetchAccounts = useCallback(async () => {
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("accounts")
      .select("id, code, name, account_type, nature")
      .eq("is_detail", true)
      .eq("is_active", true)
      .order("code", { ascending: true });

    if (err) {
      setError(err.message);
    } else {
      setAccounts(
        ((data as Account[]) ?? []).map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          accountType: a.account_type,
          nature: a.nature,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // -- Fetch T-Account data --------------------------------------------------

  const fetchTAccountData = useCallback(
    async (accountId: string) => {
      if (!accountId) return;

      setDataLoading(true);
      setError(null);
      const supabase = createClient();

      // Get account info
      const account = accounts.find((a) => a.id === accountId);
      if (!account) {
        setDataLoading(false);
        return;
      }

      // Fetch all journal entry lines for this account with confirmed entries
      let query = supabase
        .from("journal_entry_lines")
        .select(
          `
          id,
          debit,
          credit,
          description,
          journal_entry:journal_entries!inner(
            id,
            entry_number,
            date,
            status,
            description
          )
        `
        )
        .eq("account_id", accountId)
        .eq("journal_entry.status", "confirmed")
        .order("created_at", { ascending: true });

      if (dateFrom) {
        query = query.gte("journal_entry.date", dateFrom);
      }
      if (dateTo) {
        query = query.lte("journal_entry.date", dateTo);
      }

      const { data: lines, error: err } = await query;

      if (err) {
        setError(err.message);
        setDataLoading(false);
        return;
      }

      // For each line, find the counterpart line in the same journal entry
      const lineData = (lines ?? []) as Array<{
        id: string;
        debit: number;
        credit: number;
        description: string | null;
        journal_entry: {
          id: string;
          entry_number: string;
          date: string;
          status: string;
          description: string;
        };
      }>;

      // Fetch counterpart info for each entry
      const entryIds = [...new Set(lineData.map((l) => l.journal_entry.id))];
      let counterparts: Record<
        string,
        { code: string; name: string }
      > = {};

      if (entryIds.length > 0) {
        const { data: counterpartLines } = await supabase
          .from("journal_entry_lines")
          .select("journal_entry_id, account:accounts(code, name)")
          .in("journal_entry_id", entryIds)
          .neq("account_id", accountId);

        if (counterpartLines) {
          for (const cl of counterpartLines as Array<{
            journal_entry_id: string;
            account: { code: string; name: string } | null;
          }>) {
            if (cl.account) {
              counterparts[cl.journal_entry_id] = cl.account;
            }
          }
        }
      }

      // Build T-Account data
      const debits: TAccountMovement[] = [];
      const credits: TAccountMovement[] = [];
      let debitTotal = 0;
      let creditTotal = 0;

      for (const line of lineData) {
        const je = line.journal_entry;
        const cp = counterparts[je.id];

        const movement: TAccountMovement = {
          id: line.id,
          date: formatShortDate(new Date(je.date + "T00:00:00")),
          description: je.description,
          amount: Number(line.debit) > 0 ? Number(line.debit) : Number(line.credit),
          entryNumber: je.entry_number,
          counterpartCode: cp?.code,
          counterpartName: cp?.name,
        };

        if (Number(line.debit) > 0) {
          debits.push(movement);
          debitTotal += Number(line.debit);
        } else {
          credits.push(movement);
          creditTotal += Number(line.credit);
        }
      }

      const balance =
        account.nature === "debito"
          ? debitTotal - creditTotal
          : creditTotal - debitTotal;

      setTAccountData({
        code: account.code,
        name: account.name,
        accountType: account.accountType,
        nature: account.nature,
        debits,
        credits,
        debitTotal,
        creditTotal,
        balance,
      });

      setDataLoading(false);
    },
    [accounts, dateFrom, dateTo]
  );

  // Fetch data when account or date filters change
  useEffect(() => {
    if (selectedAccountId) {
      fetchTAccountData(selectedAccountId);
    }
  }, [selectedAccountId, fetchTAccountData]);

  // -- Navigate to counterpart -----------------------------------------------

  function handleCounterpartClick(code: string) {
    const account = accounts.find((a) => a.code === code);
    if (account) {
      setSelectedAccountId(account.id);
    }
  }

  // -- Filter accounts by search ---------------------------------------------

  const filteredAccounts = searchQuery.trim()
    ? accounts.filter(
        (a) =>
          a.code.includes(searchQuery) ||
          a.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : accounts;

  // Group accounts by type for the selector
  const accountsByType = filteredAccounts.reduce(
    (acc, account) => {
      const type = account.accountType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(account);
      return acc;
    },
    {} as Record<string, AccountOption[]>
  );

  const TYPE_LABELS: Record<string, string> = {
    activo: "Activos",
    pasivo: "Pasivos",
    patrimonio: "Patrimonio",
    ingreso: "Ingresos",
    gasto: "Gastos",
  };

  // -- Loading ---------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-56 animate-pulse rounded bg-muted" />
        <div className="h-10 animate-pulse rounded-lg bg-muted/30" />
        <div className="h-64 animate-pulse rounded-lg bg-muted/20" />
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

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-sm">T-Accounts</CardTitle>
              <CardDescription>
                Visualizacion de movimientos por cuenta en formato clasico T
              </CardDescription>
            </div>
            {selectedAccountId && (
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => fetchTAccountData(selectedAccountId)}
                title="Recargar"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${dataLoading ? "animate-spin" : ""}`}
                />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Account selector + filters */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cuenta</Label>
              <Select
                value={selectedAccountId}
                onValueChange={(val) => setSelectedAccountId(val as string)}
              >
                <SelectTrigger className="w-72">
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {/* Search within selector */}
                  <div className="px-1.5 pb-1">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                      <input
                        placeholder="Buscar cuenta..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-7 w-full rounded-md border border-input bg-transparent pl-7 pr-2 text-xs outline-none focus:border-ring"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  {Object.entries(accountsByType).map(([type, accs]) => (
                    <SelectGroup key={type}>
                      <SelectLabel>
                        {TYPE_LABELS[type] ?? type}
                      </SelectLabel>
                      {accs.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="font-mono text-xs tabular-nums opacity-60">
                            {a.code}
                          </span>{" "}
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Desde</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-36"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Hasta</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-36"
              />
            </div>

            {/* View level toggle */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Nivel de detalle
              </Label>
              <div className="flex items-center gap-0.5 rounded-lg bg-muted p-[3px]">
                {(["simple", "detail", "accounting"] as TAccountViewLevel[]).map(
                  (level) => (
                    <button
                      key={level}
                      onClick={() => setViewLevel(level)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        viewLevel === level
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {level === "simple"
                        ? "Simple"
                        : level === "detail"
                          ? "Detalle"
                          : "Contable"}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* T-Account display */}
      {!selectedAccountId ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-muted">
            <Columns3 className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">
              Selecciona una cuenta para ver su T-Account
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Visualiza los movimientos de debito y credito en formato clasico T
            </p>
          </div>
        </div>
      ) : dataLoading ? (
        <div className="space-y-3">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="grid grid-cols-2 gap-0">
            <div className="h-48 animate-pulse rounded-l-lg bg-muted/20" />
            <div className="h-48 animate-pulse rounded-r-lg bg-muted/30" />
          </div>
        </div>
      ) : tAccountData ? (
        <div className="mx-auto max-w-3xl">
          <TAccount
            data={tAccountData}
            level={viewLevel}
            onCounterpartClick={handleCounterpartClick}
          />

          {/* Summary below */}
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 px-1 text-xs text-muted-foreground">
            <span>
              {tAccountData.debits.length + tAccountData.credits.length}{" "}
              movimiento
              {tAccountData.debits.length + tAccountData.credits.length !== 1
                ? "s"
                : ""}
            </span>
            <span>
              Debitos: {formatCOP(tAccountData.debitTotal)}
            </span>
            <span>
              Creditos: {formatCOP(tAccountData.creditTotal)}
            </span>
            {dateFrom && <span>Desde: {dateFrom}</span>}
            {dateTo && <span>Hasta: {dateTo}</span>}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 py-12">
          <p className="text-sm text-muted-foreground">
            No hay movimientos para esta cuenta en el rango seleccionado
          </p>
        </div>
      )}
    </div>
  );
}
