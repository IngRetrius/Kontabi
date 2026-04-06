"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePageTransition } from "@/hooks/use-page-transition";
import { createClient } from "@/lib/supabase/client";
import type { Budget } from "@/types/database";
import {
  simulateIncrements,
  createBudgetFromSimulation,
  type SimulatorScenario,
  type SimulatorResult,
} from "@/lib/accounting/budget-simulator";
import { formatCOP } from "@/lib/utils/format";
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
  FlaskConical,
  Play,
  ArrowRight,
  AlertCircle,
  Loader2,
  TrendingUp,
  TrendingDown,
  Save,
} from "lucide-react";

// -- Page --------------------------------------------------------------------

export default function BudgetSimulatorPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>("");
  const [uniformIncrement, setUniformIncrement] = useState<number>(5);
  const [result, setResult] = useState<SimulatorResult | null>(null);
  const [itemOverrides, setItemOverrides] = useState<Record<string, number>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -- Fetch budgets ---------------------------------------------------------

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("budgets")
        .select("*")
        .order("year", { ascending: false });
      setBudgets((data ?? []) as Budget[]);
      if (data && data.length > 0) setSelectedBudgetId(data[0].id);
    }
    load();
  }, []);

  // -- Simulate --------------------------------------------------------------

  const handleSimulate = useCallback(async () => {
    if (!selectedBudgetId) return;
    setLoading(true);
    setError(null);

    const scenario: SimulatorScenario = {
      name: `+${uniformIncrement}% uniforme`,
      increments: itemOverrides,
      uniformIncrement,
    };

    const { result: sim, error: err } = await simulateIncrements(
      selectedBudgetId,
      scenario
    );

    if (err) setError(err);
    else setResult(sim);
    setLoading(false);
  }, [selectedBudgetId, uniformIncrement, itemOverrides]);

  // -- Create budget from result ---------------------------------------------

  const handleCreate = async () => {
    if (!result || !selectedBudgetId) return;
    setCreating(true);
    setError(null);

    const targetYear = result.baseBudgetYear + 1;
    const scenario: SimulatorScenario = {
      name: `Simulacion +${uniformIncrement}%`,
      increments: itemOverrides,
      uniformIncrement,
    };

    const { budgetId, error: err } = await createBudgetFromSimulation(
      selectedBudgetId,
      targetYear,
      `Presupuesto ${targetYear}`,
      scenario
    );

    if (err) {
      setError(err);
      setCreating(false);
      return;
    }

    router.push(`/dashboard/budget/${budgetId}`);
  };

  // -- Derived ---------------------------------------------------------------

  const selectedBudget = budgets.find((b) => b.id === selectedBudgetId);

  usePageTransition(containerRef);

  // -- Render ----------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="anim-header space-y-0.5">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-xl tracking-tight">
            Simulador de incrementos
          </h2>
        </div>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Proyecta el presupuesto del proximo ano aplicando incrementos por rubro
          o uniformes. Compara antes y despues antes de crear.
        </p>
      </div>

      {error && (
        <div className="anim-banner flex items-center gap-2.5 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Controls */}
      <Card className="anim-card">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="font-display text-sm">
            Parametros de simulacion
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Presupuesto base
            </Label>
            <Select
              value={selectedBudgetId}
              onValueChange={(v) => {
                setSelectedBudgetId(v);
                setResult(null);
                setItemOverrides({});
              }}
            >
              <SelectTrigger className="h-8 text-[13px]">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {budgets.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-[13px]">
                    {b.name} ({b.year}) &mdash; {formatCOP(b.total)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Incremento uniforme (%)
            </Label>
            <Input
              type="number"
              step="0.1"
              value={uniformIncrement}
              onChange={(e) => setUniformIncrement(Number(e.target.value) || 0)}
              className="h-8 font-mono text-[13px]"
            />
          </div>
          <div className="flex items-end">
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={!selectedBudgetId || loading}
              onClick={handleSimulate}
            >
              {loading ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-3 w-3" />
              )}
              Simular
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Base ({result.baseBudgetYear})
                </p>
                <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight">
                  {formatCOP(result.currentTotal)}
                </p>
              </CardContent>
            </Card>
            <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Proyectado ({result.baseBudgetYear + 1})
                </p>
                <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight">
                  {formatCOP(result.newTotal)}
                </p>
                <div className="absolute -right-2 -top-2 h-14 w-14 rounded-full bg-sky-500/[0.06]" />
              </CardContent>
            </Card>
            <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Diferencia
                </p>
                <p
                  className={`mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight ${
                    result.differenceTotal > 0
                      ? "text-amber-500"
                      : "text-emerald-500"
                  }`}
                >
                  {result.differenceTotal > 0 ? "+" : ""}
                  {formatCOP(result.differenceTotal)}
                </p>
              </CardContent>
            </Card>
            <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
              <CardContent className="p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  Incremento total
                </p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  {result.incrementPctTotal > 0 ? (
                    <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                  <p className="font-mono text-lg font-semibold tabular-nums tracking-tight">
                    {result.incrementPctTotal > 0 ? "+" : ""}
                    {result.incrementPctTotal}%
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Comparison table */}
          <Card className="anim-table">
            <CardHeader className="border-b px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-display text-sm">
                    Comparativo por rubro
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Modifica el % individual por rubro para escenarios mixtos.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={creating}
                  onClick={handleCreate}
                >
                  {creating ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 h-3 w-3" />
                  )}
                  Crear presupuesto {result.baseBudgetYear + 1}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4 text-[11px] font-medium uppercase tracking-wider">
                        Rubro
                      </TableHead>
                      <TableHead className="w-32 text-right text-[11px] font-medium uppercase tracking-wider">
                        Actual / mes
                      </TableHead>
                      <TableHead className="w-20 text-center text-[11px] font-medium uppercase tracking-wider">
                        %
                      </TableHead>
                      <TableHead className="w-12 text-center text-[11px] font-medium uppercase tracking-wider" />
                      <TableHead className="w-32 text-right text-[11px] font-medium uppercase tracking-wider">
                        Nuevo / mes
                      </TableHead>
                      <TableHead className="w-32 text-right text-[11px] font-medium uppercase tracking-wider">
                        Nuevo / anual
                      </TableHead>
                      <TableHead className="w-28 text-right pr-4 text-[11px] font-medium uppercase tracking-wider">
                        Diferencia
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.items.map((item) => (
                      <TableRow key={item.itemId}>
                        <TableCell className="pl-4 text-[13px] font-medium">
                          {item.itemName}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                          {formatCOP(item.currentMonthly)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            step="0.1"
                            value={
                              itemOverrides[item.itemId] ?? uniformIncrement
                            }
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setItemOverrides((prev) => ({
                                ...prev,
                                [item.itemId]: val,
                              }));
                            }}
                            className="h-6 w-16 text-center font-mono text-[11px]"
                          />
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground/30">
                          <ArrowRight className="mx-auto h-3 w-3" />
                        </TableCell>
                        <TableCell className="text-right font-mono text-[13px] tabular-nums">
                          {formatCOP(item.newMonthly)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[13px] tabular-nums">
                          {formatCOP(item.newAnnual)}
                        </TableCell>
                        <TableCell
                          className={`pr-4 text-right font-mono text-[13px] tabular-nums ${
                            item.differenceAnnual > 0
                              ? "text-amber-500"
                              : item.differenceAnnual < 0
                                ? "text-emerald-500"
                                : "text-muted-foreground"
                          }`}
                        >
                          {item.differenceAnnual > 0 ? "+" : ""}
                          {formatCOP(item.differenceAnnual)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 border-border bg-muted/30 font-semibold hover:bg-muted/30">
                      <TableCell className="pl-4 text-[13px]">Total</TableCell>
                      <TableCell className="text-right font-mono text-[13px] tabular-nums">
                        {formatCOP(Math.round(result.currentTotal / 12))}
                      </TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell className="text-right font-mono text-[13px] tabular-nums">
                        {formatCOP(Math.round(result.newTotal / 12))}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[13px] tabular-nums">
                        {formatCOP(result.newTotal)}
                      </TableCell>
                      <TableCell className="pr-4 text-right font-mono text-[13px] tabular-nums text-amber-500">
                        +{formatCOP(result.differenceTotal)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
