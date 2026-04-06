"use client";

import { useState, useMemo, useCallback } from "react";
import {
  distributeEqually,
  rebalance,
  validateCoefficientSum,
} from "@/lib/utils/coefficient";
import { formatCoefficient } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Lock,
  Unlock,
  Scale,
  SplitSquareHorizontal,
  Save,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Home,
  Store,
  Car,
  Package,
} from "lucide-react";

// -- Types ------------------------------------------------------------------

export interface CoefficientUnit {
  id: string;
  number: string;
  building_name: string;
  unit_type: string;
  coefficient: number;
}

interface CoefficientEditorProps {
  units: CoefficientUnit[];
  onSave: (updates: { id: string; coefficient: number }[]) => Promise<void>;
  saving: boolean;
}

// -- Constants --------------------------------------------------------------

const UNIT_TYPE_ICONS: Record<string, typeof Home> = {
  apartment: Home,
  commercial: Store,
  parking: Car,
  storage: Package,
};

const UNIT_TYPE_LABELS: Record<string, string> = {
  apartment: "Apto",
  commercial: "Local",
  parking: "Parq.",
  storage: "Dep.",
};

// -- Component --------------------------------------------------------------

export function CoefficientEditor({
  units,
  onSave,
  saving,
}: CoefficientEditorProps) {
  const [coefficients, setCoefficients] = useState<Map<string, number>>(() => {
    const map = new Map<string, number>();
    units.forEach((u) => map.set(u.id, u.coefficient));
    return map;
  });

  const [lockedIds, setLockedIds] = useState<Set<string>>(new Set());
  const [inputValues, setInputValues] = useState<Map<string, string>>(() => {
    const map = new Map<string, string>();
    units.forEach((u) => map.set(u.id, formatCoefficient(u.coefficient)));
    return map;
  });

  // -- Derived state --------------------------------------------------------

  const validation = useMemo(() => {
    const values = units.map((u) => coefficients.get(u.id) ?? 0);
    return validateCoefficientSum(values);
  }, [units, coefficients]);

  const hasChanges = useMemo(() => {
    return units.some(
      (u) => (coefficients.get(u.id) ?? 0) !== u.coefficient
    );
  }, [units, coefficients]);

  const allZero = useMemo(() => {
    return units.every((u) => (coefficients.get(u.id) ?? 0) === 0);
  }, [units, coefficients]);

  // -- Actions --------------------------------------------------------------

  const applyEqualDistribution = useCallback(() => {
    const values = distributeEqually(units.length);
    const newCoeffs = new Map<string, number>();
    const newInputs = new Map<string, string>();
    units.forEach((u, i) => {
      newCoeffs.set(u.id, values[i]);
      newInputs.set(u.id, formatCoefficient(values[i]));
    });
    setCoefficients(newCoeffs);
    setInputValues(newInputs);
    setLockedIds(new Set());
  }, [units]);

  const applyRebalance = useCallback(() => {
    const entries = units.map((u) => ({
      id: u.id,
      coefficient: coefficients.get(u.id) ?? 0,
      isLocked: lockedIds.has(u.id),
    }));
    const result = rebalance(entries);
    const newCoeffs = new Map<string, number>();
    const newInputs = new Map<string, string>();
    result.forEach((r) => {
      newCoeffs.set(r.id, r.coefficient);
      newInputs.set(r.id, formatCoefficient(r.coefficient));
    });
    setCoefficients(newCoeffs);
    setInputValues(newInputs);
  }, [units, coefficients, lockedIds]);

  const handleInputChange = useCallback((id: string, raw: string) => {
    setInputValues((prev) => {
      const next = new Map(prev);
      next.set(id, raw);
      return next;
    });
  }, []);

  const handleInputBlur = useCallback(
    (id: string) => {
      const raw = inputValues.get(id) ?? "0";
      const parsed = parseFloat(raw);
      const value = isNaN(parsed) ? 0 : Math.max(0, Math.min(100, parsed));
      const rounded = Math.round(value * 1_000_000) / 1_000_000;

      setCoefficients((prev) => {
        const next = new Map(prev);
        next.set(id, rounded);
        return next;
      });
      setInputValues((prev) => {
        const next = new Map(prev);
        next.set(id, formatCoefficient(rounded));
        return next;
      });
      setLockedIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    },
    [inputValues]
  );

  const toggleLock = useCallback((id: string) => {
    setLockedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    const updates = units.map((u) => ({
      id: u.id,
      coefficient: coefficients.get(u.id) ?? 0,
    }));
    await onSave(updates);
  }, [units, coefficients, onSave]);

  // -- Empty state ----------------------------------------------------------

  if (units.length === 0) {
    return (
      <p className="py-4 text-center text-[13px] text-muted-foreground">
        Agrega unidades primero para configurar los coeficientes.
      </p>
    );
  }

  // -- Single unit ----------------------------------------------------------

  if (units.length === 1) {
    return (
      <div className="space-y-3">
        <p className="text-[13px] text-muted-foreground">
          Con una sola unidad, el coeficiente es automaticamente 100%.
        </p>
        <div className="flex items-center justify-between rounded-lg border px-4 py-3">
          <span className="text-[13px] font-medium">
            {units[0].number} - {units[0].building_name}
          </span>
          <span className="font-mono text-[13px] font-semibold tabular-nums">
            100.000000%
          </span>
        </div>
        {coefficients.get(units[0].id) !== 100 && (
          <Button
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              const newCoeffs = new Map([[units[0].id, 100]]);
              const newInputs = new Map([[units[0].id, "100.000000"]]);
              setCoefficients(newCoeffs);
              setInputValues(newInputs);
              onSave([{ id: units[0].id, coefficient: 100 }]);
            }}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3 w-3" />
            )}
            Guardar coeficiente
          </Button>
        )}
      </div>
    );
  }

  // -- Main render ----------------------------------------------------------

  const lockedCount = lockedIds.size;
  const hasUnlocked = lockedCount < units.length;

  return (
    <div className="space-y-3">
      {/* Header: Total + Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Total
          </span>
          <span
            className={`font-mono text-sm font-semibold tabular-nums ${
              allZero
                ? "text-muted-foreground"
                : validation.valid
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-destructive"
            }`}
          >
            {validation.formatted}%
          </span>
          {!allZero &&
            (validation.valid ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px]"
            onClick={applyEqualDistribution}
          >
            <SplitSquareHorizontal className="mr-1.5 h-3 w-3" />
            Distribuir igual
          </Button>
          {lockedCount > 0 && hasUnlocked && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={applyRebalance}
            >
              <Scale className="mr-1.5 h-3 w-3" />
              Rebalancear
            </Button>
          )}
        </div>
      </div>

      {/* Info text */}
      <p className="text-[11px] text-muted-foreground/70">
        {units.length} unidades.
        {lockedCount > 0
          ? ` ${lockedCount} bloqueada${lockedCount > 1 ? "s" : ""} manualmente.`
          : " Edita un valor para bloquearlo, luego usa Rebalancear."
        }
      </p>

      {/* Table */}
      <div className="max-h-[400px] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[11px]">Numero</TableHead>
              <TableHead className="text-[11px]">Torre</TableHead>
              <TableHead className="text-[11px]">Tipo</TableHead>
              <TableHead className="w-36 text-right text-[11px]">
                Coeficiente %
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.map((unit) => {
              const Icon = UNIT_TYPE_ICONS[unit.unit_type] ?? Home;
              const isLocked = lockedIds.has(unit.id);

              return (
                <TableRow key={unit.id}>
                  <TableCell className="font-mono text-[13px] font-medium tabular-nums">
                    {unit.number}
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {unit.building_name}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Icon className="h-3 w-3" />
                      {UNIT_TYPE_LABELS[unit.unit_type] ?? unit.unit_type}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.000001"
                      min="0"
                      max="100"
                      value={inputValues.get(unit.id) ?? "0"}
                      onChange={(e) =>
                        handleInputChange(unit.id, e.target.value)
                      }
                      onBlur={() => handleInputBlur(unit.id)}
                      className="ml-auto h-7 w-28 text-right font-mono text-[12px] tabular-nums"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-6 w-6 p-0 ${
                        isLocked
                          ? "text-foreground"
                          : "text-muted-foreground/40"
                      }`}
                      onClick={() => toggleLock(unit.id)}
                      title={isLocked ? "Desbloquear" : "Bloquear"}
                    >
                      {isLocked ? (
                        <Lock className="h-3 w-3" />
                      ) : (
                        <Unlock className="h-3 w-3" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Validation message */}
      {!allZero && !validation.valid && (
        <p className="text-[11px] text-destructive">
          La suma debe ser exactamente 100.000000%. Diferencia:{" "}
          {(validation.sum - 100).toFixed(6)}%
        </p>
      )}

      {/* Save button */}
      <Button
        size="sm"
        className="w-full text-xs"
        onClick={handleSave}
        disabled={saving || (!validation.valid && !allZero) || !hasChanges}
      >
        {saving ? (
          <>
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            Guardando...
          </>
        ) : (
          <>
            <Save className="mr-1.5 h-3 w-3" />
            Guardar coeficientes
          </>
        )}
      </Button>
    </div>
  );
}
