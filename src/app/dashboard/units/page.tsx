"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { usePageTransition } from "@/hooks/use-page-transition";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { formatCoefficient } from "@/lib/utils/format";
import type { Building, UnitType } from "@/types/database";
import { BuildingsDialog } from "@/components/units/buildings-dialog";
import { CoefficientEditor } from "@/components/units/coefficient-editor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Building2,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  Home,
  Store,
  Car,
  Package,
  AlertCircle,
  Percent,
} from "lucide-react";

// -- Types for joined query results ----------------------------------------

interface UnitRow {
  id: string;
  tenant_id: string;
  building_id: string;
  number: string;
  floor: number;
  unit_type: UnitType;
  area_m2: number;
  coefficient: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  building: { id: string; name: string };
  owners: { id: string; full_name: string; is_current: boolean }[];
}

// -- Constants --------------------------------------------------------------

const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  apartment: "Apartamento",
  commercial: "Local comercial",
  parking: "Parqueadero",
  storage: "Deposito",
};

const UNIT_TYPE_ICONS: Record<UnitType, typeof Home> = {
  apartment: Home,
  commercial: Store,
  parking: Car,
  storage: Package,
};

const UNIT_TYPE_BADGE_VARIANT: Record<
  UnitType,
  "default" | "secondary" | "outline"
> = {
  apartment: "default",
  commercial: "secondary",
  parking: "outline",
  storage: "outline",
};

// -- Zod schema for unit creation ------------------------------------------

const unitSchema = z.object({
  building_id: z.string().min(1, "Selecciona una torre"),
  number: z.string().min(1, "El numero es requerido"),
  floor: z.number().min(0, "El piso debe ser 0 o mayor"),
  unit_type: z.enum(["apartment", "commercial", "parking", "storage"]),
  area_m2: z.number().positive("El area debe ser mayor a 0"),
});

type UnitFormData = z.infer<typeof unitSchema>;

// -- Component --------------------------------------------------------------

export default function UnitsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Data
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [filterBuilding, setFilterBuilding] = useState<string>("__all__");
  const [filterType, setFilterType] = useState<string>("__all__");

  // Dialogs
  const [showBuildingsDialog, setShowBuildingsDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCoefficientDialog, setShowCoefficientDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coefficientSaving, setCoefficientSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UnitFormData>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      building_id: "",
      number: "",
      floor: 1,
      unit_type: "apartment",
      area_m2: 0,
    },
  });

  const selectedBuildingId = watch("building_id");
  const selectedUnitType = watch("unit_type");

  // -- Data fetching --------------------------------------------------------

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [unitsRes, buildingsRes] = await Promise.all([
      supabase
        .from("units")
        .select("*, building:buildings(id, name), owners(id, full_name, is_current)")
        .order("number"),
      supabase.from("buildings").select("*").order("name"),
    ]);
    setUnits((unitsRes.data as UnitRow[]) ?? []);
    setBuildings(buildingsRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -- Filtering ------------------------------------------------------------

  const filtered = useMemo(() => {
    return units.filter((u) => {
      if (filterBuilding !== "__all__" && u.building_id !== filterBuilding)
        return false;
      if (filterType !== "__all__" && u.unit_type !== filterType) return false;
      if (search && !u.number.toLowerCase().includes(search.toLowerCase()))
        return false;
      return true;
    });
  }, [units, filterBuilding, filterType, search]);

  // -- Stats ----------------------------------------------------------------

  const coefficientSum = useMemo(
    () => units.reduce((sum, u) => sum + Number(u.coefficient), 0),
    [units]
  );

  const coefficientValid =
    coefficientSum >= 99.9999 && coefficientSum <= 100.0001;

  const activeCount = useMemo(
    () => units.filter((u) => u.is_active).length,
    [units]
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    units.forEach((u) => {
      counts[u.unit_type] = (counts[u.unit_type] || 0) + 1;
    });
    return counts;
  }, [units]);

  // -- Create unit ----------------------------------------------------------

  async function onCreateUnit(data: UnitFormData) {
    setIsSubmitting(true);
    setSubmitError(null);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSubmitError("No hay sesion activa");
      setIsSubmitting(false);
      return;
    }

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_id", user.id)
      .single();

    if (!userData) {
      setSubmitError("No se encontro el tenant");
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from("units").insert({
      tenant_id: userData.tenant_id,
      building_id: data.building_id,
      number: data.number,
      floor: data.floor,
      unit_type: data.unit_type,
      area_m2: data.area_m2,
    });

    if (error) {
      setSubmitError(
        error.message.includes("idx_units_number_building")
          ? "Ya existe una unidad con ese numero en esta torre"
          : error.message
      );
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setShowCreateDialog(false);
    reset();
    fetchData();
  }

  // -- Helpers --------------------------------------------------------------

  function currentOwner(unit: UnitRow): string | null {
    const owner = unit.owners?.find((o) => o.is_current);
    return owner ? owner.full_name : null;
  }

  usePageTransition(containerRef, { ready: !loading });

  // -- Loading state --------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-1.5">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border bg-muted/40"
            />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg border bg-muted/40" />
      </div>
    );
  }

  // -- Render ---------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-6">
      {/* ---- Header ---- */}
      <div className="anim-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Unidades</h2>
          <p className="text-sm text-muted-foreground">
            Gestiona las unidades de tu conjunto
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBuildingsDialog(true)}
          >
            <Building2 className="mr-1.5 h-3.5 w-3.5" />
            Gestionar torres
          </Button>
          {units.length >= 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCoefficientDialog(true)}
            >
              <Percent className="mr-1.5 h-3.5 w-3.5" />
              Coeficientes
            </Button>
          )}
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nueva unidad
          </Button>
        </div>
      </div>

      {/* ---- Summary stats ---- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total */}
        <div className="anim-kpi rounded-lg border bg-background px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Total de unidades
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {units.length}
          </p>
        </div>

        {/* Coefficient */}
        <div className="anim-kpi rounded-lg border bg-background px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Coeficiente total
          </p>
          <div className="mt-1 flex items-center gap-2">
            <p
              className={`text-2xl font-semibold tabular-nums ${
                units.length === 0
                  ? "text-muted-foreground"
                  : coefficientValid
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-destructive"
              }`}
            >
              {formatCoefficient(coefficientSum)}%
            </p>
            {units.length > 0 &&
              (coefficientValid ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ))}
          </div>
        </div>

        {/* Active */}
        <div className="anim-kpi rounded-lg border bg-background px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Activas
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {activeCount}
            {units.length > 0 && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                / {units.length}
              </span>
            )}
          </p>
        </div>

        {/* Type breakdown */}
        <div className="anim-kpi rounded-lg border bg-background px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Por tipo
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((type) => {
              const count = typeCounts[type] || 0;
              if (count === 0) return null;
              const Icon = UNIT_TYPE_ICONS[type];
              return (
                <Badge key={type} variant="outline" className="gap-1 font-normal">
                  <Icon className="h-3 w-3" />
                  {count}
                </Badge>
              );
            })}
            {units.length === 0 && (
              <span className="text-sm text-muted-foreground">--</span>
            )}
          </div>
        </div>
      </div>

      {/* ---- Coefficient warning ---- */}
      {units.length > 0 && !coefficientValid && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            {coefficientSum < 0.0001 ? (
              <>
                <p className="font-medium">Coeficientes no configurados</p>
                <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                  Los coeficientes de copropiedad no han sido distribuidos.
                  Deben sumar 100% para cumplir con la Ley 675.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">Coeficientes no balanceados</p>
                <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                  La suma de coeficientes es {formatCoefficient(coefficientSum)}%.
                  Debe ser exactamente 100.000000% para cumplir con la Ley 675.
                </p>
              </>
            )}
            {units.length >= 2 && (
              <button
                className="mt-1.5 text-xs font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700 dark:text-amber-200 dark:hover:text-amber-100"
                onClick={() => setShowCoefficientDialog(true)}
              >
                Gestionar coeficientes
              </button>
            )}
          </div>
        </div>
      )}

      {/* ---- Filters ---- */}
      <div className="anim-filter flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por numero..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-9"
          />
        </div>

        <Select
          value={filterBuilding}
          onValueChange={(val) => setFilterBuilding(val as string)}
        >
          <SelectTrigger className="w-45">
            <SelectValue placeholder="Todas las torres" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas las torres</SelectItem>
            {buildings.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterType}
          onValueChange={(val) => setFilterType(val as string)}
        >
          <SelectTrigger className="w-45">
            <SelectValue placeholder="Todos los tipos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos los tipos</SelectItem>
            {(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((type) => (
              <SelectItem key={type} value={type}>
                {UNIT_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ---- Table ---- */}
      <div className="anim-table rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Numero</TableHead>
              <TableHead>Torre</TableHead>
              <TableHead className="text-right">Piso</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">
                Area m<sup>2</sup>
              </TableHead>
              <TableHead className="text-right">Coeficiente</TableHead>
              <TableHead>Propietario</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={8}
                  className="h-32 text-center text-muted-foreground"
                >
                  {units.length === 0
                    ? "No hay unidades registradas. Crea la primera torre y luego agrega unidades."
                    : "No se encontraron unidades con los filtros aplicados."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((unit) => {
                const Icon = UNIT_TYPE_ICONS[unit.unit_type];
                const owner = currentOwner(unit);

                return (
                  <TableRow
                    key={unit.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/dashboard/units/${unit.id}`)
                    }
                  >
                    <TableCell className="font-medium">{unit.number}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {unit.building?.name ?? "--"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {unit.floor}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={UNIT_TYPE_BADGE_VARIANT[unit.unit_type]}
                        className="gap-1"
                      >
                        <Icon className="h-3 w-3" />
                        {UNIT_TYPE_LABELS[unit.unit_type]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {unit.area_m2.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {formatCoefficient(Number(unit.coefficient))}
                    </TableCell>
                    <TableCell>
                      {owner ? (
                        <span className="text-sm">{owner}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Sin propietario
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={unit.is_active ? "default" : "destructive"}
                        className="text-[10px]"
                      >
                        {unit.is_active ? "Activa" : "Inactiva"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ---- Buildings dialog ---- */}
      <BuildingsDialog
        open={showBuildingsDialog}
        onOpenChange={setShowBuildingsDialog}
        buildings={buildings}
        onUpdate={fetchData}
      />

      {/* ---- Create unit dialog ---- */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            reset();
            setSubmitError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva unidad</DialogTitle>
            <DialogDescription>
              Registra una nueva unidad en el conjunto
            </DialogDescription>
          </DialogHeader>

          {submitError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {buildings.length === 0 ? (
            <div className="space-y-3 py-4 text-center">
              <p className="text-sm text-muted-foreground">
                Debes crear al menos una torre antes de agregar unidades.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCreateDialog(false);
                  setShowBuildingsDialog(true);
                }}
              >
                <Building2 className="mr-1.5 h-3.5 w-3.5" />
                Gestionar torres
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit(onCreateUnit)}
              className="space-y-4"
            >
              {/* Building select */}
              <div className="space-y-1.5">
                <Label>Torre</Label>
                <Select
                  value={selectedBuildingId}
                  onValueChange={(val) =>
                    setValue("building_id", val as string, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar torre" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.building_id && (
                  <p className="text-xs text-destructive">
                    {errors.building_id.message}
                  </p>
                )}
              </div>

              {/* Number + Floor row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="unit-number">Numero</Label>
                  <Input
                    id="unit-number"
                    placeholder="101"
                    {...register("number")}
                    aria-invalid={!!errors.number}
                  />
                  {errors.number && (
                    <p className="text-xs text-destructive">
                      {errors.number.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unit-floor">Piso</Label>
                  <Input
                    id="unit-floor"
                    type="number"
                    min={0}
                    {...register("floor", { valueAsNumber: true })}
                    aria-invalid={!!errors.floor}
                  />
                  {errors.floor && (
                    <p className="text-xs text-destructive">
                      {errors.floor.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Type select */}
              <div className="space-y-1.5">
                <Label>Tipo de unidad</Label>
                <Select
                  value={selectedUnitType}
                  onValueChange={(val) =>
                    setValue("unit_type", val as UnitType, {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map(
                      (type) => (
                        <SelectItem key={type} value={type}>
                          {UNIT_TYPE_LABELS[type]}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                {errors.unit_type && (
                  <p className="text-xs text-destructive">
                    {errors.unit_type.message}
                  </p>
                )}
              </div>

              {/* Area */}
              <div className="space-y-1.5">
                <Label htmlFor="unit-area">
                  Area m<sup>2</sup>
                </Label>
                <Input
                  id="unit-area"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="45.50"
                  {...register("area_m2", { valueAsNumber: true })}
                  aria-invalid={!!errors.area_m2}
                />
                {errors.area_m2 && (
                  <p className="text-xs text-destructive">
                    {errors.area_m2.message}
                  </p>
                )}
              </div>

              <DialogFooter>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                      Creando...
                    </span>
                  ) : (
                    "Crear unidad"
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ---- Coefficient editor dialog ---- */}
      <Dialog open={showCoefficientDialog} onOpenChange={setShowCoefficientDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gestionar coeficientes</DialogTitle>
            <DialogDescription>
              Distribuye los coeficientes de copropiedad (Ley 675). Deben sumar exactamente 100%.
            </DialogDescription>
          </DialogHeader>
          <CoefficientEditor
            units={units.map((u) => ({
              id: u.id,
              number: u.number,
              building_name: u.building?.name ?? "--",
              unit_type: u.unit_type,
              coefficient: Number(u.coefficient),
            }))}
            onSave={async (updates) => {
              setCoefficientSaving(true);
              const supabase = createClient();
              await Promise.all(
                updates.map(({ id, coefficient }) =>
                  supabase.from("units").update({ coefficient }).eq("id", id)
                )
              );
              setCoefficientSaving(false);
              setShowCoefficientDialog(false);
              fetchData();
            }}
            saving={coefficientSaving}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

