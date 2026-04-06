"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePageTransition } from "@/hooks/use-page-transition";
import { createClient } from "@/lib/supabase/client";
import { parseStatement } from "@/lib/reconciliation/parsers";
import { formatCOP } from "@/lib/utils/format";
import type { ParseResult, BankFormat } from "@/types/database";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Loader2,
  X,
} from "lucide-react";

// -- Constants ---------------------------------------------------------------

const BANK_LABELS: Record<BankFormat, string> = {
  bancolombia: "Bancolombia",
  davivienda: "Davivienda",
  bbva: "BBVA",
  generic: "Generico (CSV)",
};

// -- Page --------------------------------------------------------------------

export default function ReconciliationImportPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [period, setPeriod] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [bankAccounts, setBankAccounts] = useState<
    { id: string; bank_name: string; account_number: string }[]
  >([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  usePageTransition(containerRef, { ready: true });

  // -- Load bank accounts on mount -------------------------------------------

  useState(() => {
    const load = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("bank_accounts")
        .select("id, bank_name, account_number")
        .eq("is_active", true)
        .order("bank_name");
      setBankAccounts(data ?? []);
    };
    load();
  });

  // -- File handler ----------------------------------------------------------

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);
    setFileName(f.name);
    setError(null);
    setParseResult(null);

    try {
      const content = await f.text();
      const result = parseStatement(content);
      setParseResult(result);
    } catch (err) {
      setError(`Error al leer el archivo: ${(err as Error).message}`);
    }
  }

  function clearFile() {
    setFile(null);
    setFileName("");
    setParseResult(null);
    setError(null);
  }

  // -- Import ----------------------------------------------------------------

  async function handleImport() {
    if (!parseResult || !period) return;

    setImporting(true);
    setError(null);

    try {
      const supabase = createClient();

      // Create statement
      const { data: stmt, error: stmtErr } = await supabase
        .from("bank_statements")
        .insert({
          bank_name: BANK_LABELS[parseResult.bank],
          bank_account_id: bankAccountId || null,
          period,
          file_name: fileName,
          total_lines: parseResult.lines.length,
          total_debits: parseResult.totalDebits,
          total_credits: parseResult.totalCredits,
          status: "pending",
        })
        .select("id")
        .single();

      if (stmtErr) throw new Error(stmtErr.message);

      // Insert lines
      const lines = parseResult.lines.map((line) => ({
        statement_id: stmt.id,
        line_date: line.date,
        description: line.description,
        reference: line.reference || null,
        amount: line.amount,
        line_type: line.type,
        balance: line.balance ?? null,
        match_status: "pending" as const,
        raw_data: line.rawData,
      }));

      const { error: linesErr } = await supabase
        .from("bank_statement_rows")
        .insert(lines);

      if (linesErr) throw new Error(linesErr.message);

      router.push(`/dashboard/reconciliation/${stmt.id}`);
    } catch (err) {
      setError((err as Error).message);
      setImporting(false);
    }
  }

  // -- Render ----------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="anim-header">
        <h2 className="font-display text-xl tracking-tight">
          Importar extracto bancario
        </h2>
        <p className="text-[13px] text-muted-foreground">
          Sube un archivo CSV de tu banco para iniciar la conciliacion
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Upload area */}
      <Card className="anim-card">
        <CardHeader>
          <CardTitle className="font-display text-sm">
            Archivo CSV
          </CardTitle>
          <CardDescription>
            Soporta extractos de Bancolombia, Davivienda, BBVA y formato generico
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!file ? (
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border/60 bg-muted/20 px-6 py-10 text-center transition-colors hover:border-foreground/20 hover:bg-muted/30">
              <Upload className="h-6 w-6 text-muted-foreground/50" />
              <div>
                <p className="text-[13px] font-medium">
                  Arrastra o selecciona un archivo CSV
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                  Maximo 5MB
                </p>
              </div>
              <input
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3">
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{fileName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {parseResult
                    ? `${parseResult.lines.length} movimientos detectados -- ${BANK_LABELS[parseResult.bank]}`
                    : "Procesando..."}
                </p>
              </div>
              <Button variant="ghost" size="icon-xs" onClick={clearFile}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parse errors */}
      {parseResult && parseResult.errors.length > 0 && (
        <Card className="anim-card border-destructive/20">
          <CardHeader>
            <CardTitle className="font-display text-sm text-destructive">
              Errores de formato
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-[13px] text-destructive">
              {parseResult.errors.map((err, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                  {err}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Preview + metadata */}
      {parseResult && parseResult.lines.length > 0 && (
        <>
          {/* Settings */}
          <Card className="anim-card">
            <CardHeader>
              <CardTitle className="font-display text-sm">
                Configuracion de importacion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Periodo</Label>
                  <Input
                    type="month"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    placeholder="2026-03"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Cuenta bancaria</Label>
                  <Select value={bankAccountId} onValueChange={setBankAccountId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccionar cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((ba) => (
                        <SelectItem key={ba.id} value={ba.id}>
                          {ba.bank_name} - {ba.account_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Total debitos
                </p>
                <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight text-rose-600 dark:text-rose-400">
                  {formatCOP(parseResult.totalDebits)}
                </p>
              </CardContent>
            </Card>
            <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Total creditos
                </p>
                <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
                  {formatCOP(parseResult.totalCredits)}
                </p>
              </CardContent>
            </Card>
            <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Movimientos
                </p>
                <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight">
                  {parseResult.lines.length}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Preview table */}
          <Card className="anim-table">
            <CardHeader className="border-b px-4 py-3">
              <CardTitle className="font-display text-sm">
                Vista previa
              </CardTitle>
              <CardDescription className="text-[11px]">
                Primeros 10 movimientos del extracto
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-24 pl-4 text-[11px] font-medium uppercase tracking-wider">
                      Fecha
                    </TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                      Descripcion
                    </TableHead>
                    <TableHead className="w-20 text-[11px] font-medium uppercase tracking-wider">
                      Tipo
                    </TableHead>
                    <TableHead className="w-32 pr-4 text-right text-[11px] font-medium uppercase tracking-wider">
                      Monto
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parseResult.lines.slice(0, 10).map((line, i) => (
                    <TableRow key={i}>
                      <TableCell className="pl-4 font-mono text-[12px] tabular-nums text-muted-foreground">
                        {line.date}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-[13px]">
                        {line.description}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-[11px] font-medium ${
                            line.type === "credit"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {line.type === "credit" ? "Credito" : "Debito"}
                        </span>
                      </TableCell>
                      <TableCell className="pr-4 text-right font-mono text-[13px] font-semibold tabular-nums">
                        {formatCOP(line.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parseResult.lines.length > 10 && (
                <div className="border-t px-4 py-2 text-center text-[11px] text-muted-foreground">
                  ...y {parseResult.lines.length - 10} movimientos mas
                </div>
              )}
            </CardContent>
          </Card>

          {/* Import button */}
          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={handleImport}
              disabled={importing || !period}
            >
              {importing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importando...
                </span>
              ) : (
                <>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  Importar {parseResult.lines.length} movimientos
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
