"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usePageTransition } from "@/hooks/use-page-transition";
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
import { CoefficientEditor } from "@/components/units/coefficient-editor";
import type { CoefficientUnit } from "@/components/units/coefficient-editor";
import { distributeEqually } from "@/lib/utils/coefficient";
import {
  Building2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  CheckCircle2,
  Landmark,
  Home,
  Info,
} from "lucide-react";

// -- Types -------------------------------------------------------------------

interface TenantData {
  id: string;
  name: string;
  nit: string;
  address: string;
  city: string;
  department: string;
  stratum: number;
  phone: string;
  email: string;
}

interface BuildingRow {
  id: string;
  name: string;
  floors: number;
}

interface UnitRow {
  id: string;
  building_id: string;
  number: string;
  floor: number;
  unit_type: string;
  area_m2: number;
  coefficient: number;
}

const STEPS = [
  { num: 1, label: "Conjunto", icon: Building2 },
  { num: 2, label: "Estructura", icon: Home },
  { num: 3, label: "Banco", icon: Landmark },
] as const;

const UNIT_TYPE_LABELS: Record<string, string> = {
  apartment: "Apartamento",
  commercial: "Local comercial",
  parking: "Parqueadero",
  storage: "Deposito",
};

// -- Page Component ----------------------------------------------------------

export default function SetupPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Tenant data
  const [tenant, setTenant] = useState<TenantData>({
    id: "",
    name: "",
    nit: "",
    address: "",
    city: "Bogota",
    department: "Cundinamarca",
    stratum: 3,
    phone: "",
    email: "",
  });

  // Step 2: Buildings + Units
  const [buildings, setBuildings] = useState<BuildingRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [newBuildingName, setNewBuildingName] = useState("");
  const [newBuildingFloors, setNewBuildingFloors] = useState("10");
  const [newUnit, setNewUnit] = useState({
    building_id: "",
    number: "",
    floor: "1",
    unit_type: "apartment",
    area_m2: "",
  });
  const [coefficientSaving, setCoefficientSaving] = useState(false);

  // Step 3: Bank account
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState("corriente");

  // -- Init ------------------------------------------------------------------

  const fetchTenant = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_id", user.id)
      .single();

    if (!userData) {
      setError("No se encontro el usuario");
      setLoading(false);
      return;
    }

    setTenantId(userData.tenant_id);

    // Check if already completed
    const { data: tenantData } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", userData.tenant_id)
      .single();

    if (tenantData?.onboarding_completed_at) {
      router.push("/dashboard/overview");
      return;
    }

    if (tenantData) {
      setTenant({
        id: tenantData.id,
        name: tenantData.name ?? "",
        nit: tenantData.nit === "000000000" ? "" : tenantData.nit ?? "",
        address: tenantData.address === "Por configurar" ? "" : tenantData.address ?? "",
        city: tenantData.city ?? "Bogota",
        department: tenantData.department ?? "Cundinamarca",
        stratum: tenantData.stratum ?? 3,
        phone: tenantData.phone ?? "",
        email: tenantData.email ?? user.email ?? "",
      });
    }

    // Load existing buildings/units if any
    const { data: existingBuildings } = await supabase
      .from("buildings")
      .select("id, name, floors")
      .eq("tenant_id", userData.tenant_id)
      .order("name");
    if (existingBuildings) setBuildings(existingBuildings);

    const { data: existingUnits } = await supabase
      .from("units")
      .select("id, building_id, number, floor, unit_type, area_m2, coefficient")
      .eq("tenant_id", userData.tenant_id)
      .order("number");
    if (existingUnits) {
      setUnits(
        existingUnits.map((u) => ({
          ...u,
          area_m2: Number(u.area_m2),
          coefficient: Number(u.coefficient),
        }))
      );
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  // -- Step 1: Save tenant ---------------------------------------------------

  const saveStep1 = async () => {
    if (!tenant.name.trim() || !tenant.nit.trim() || !tenant.address.trim()) {
      setError("Nombre, NIT y direccion son obligatorios");
      return false;
    }
    const nitClean = tenant.nit.replace(/\D/g, "");
    if (nitClean.length < 9 || nitClean.length > 10) {
      setError("El NIT debe tener 9 o 10 digitos");
      return false;
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { error: updErr } = await supabase
      .from("tenants")
      .update({
        name: tenant.name.trim(),
        nit: nitClean,
        address: tenant.address.trim(),
        city: tenant.city.trim() || "Bogota",
        department: tenant.department.trim() || "Cundinamarca",
        stratum: tenant.stratum,
        phone: tenant.phone.trim() || null,
        email: tenant.email.trim() || null,
      })
      .eq("id", tenantId);

    setSaving(false);
    if (updErr) {
      setError(updErr.message);
      return false;
    }
    return true;
  };

  // -- Step 2: Add building --------------------------------------------------

  const addBuilding = async () => {
    if (!newBuildingName.trim() || !tenantId) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { data, error: err } = await supabase
      .from("buildings")
      .insert({
        tenant_id: tenantId,
        name: newBuildingName.trim(),
        floors: Number(newBuildingFloors) || 10,
      })
      .select("id, name, floors")
      .single();

    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data) {
      setBuildings((prev) => [...prev, data]);
      setNewBuildingName("");
      setNewBuildingFloors("10");
    }
  };

  const removeBuilding = async (id: string) => {
    const hasUnits = units.some((u) => u.building_id === id);
    if (hasUnits) {
      setError("Elimina primero las unidades de esta torre");
      return;
    }
    const supabase = createClient();
    await supabase.from("buildings").delete().eq("id", id);
    setBuildings((prev) => prev.filter((b) => b.id !== id));
  };

  // -- Step 2: Add unit ------------------------------------------------------

  const addUnit = async () => {
    if (!newUnit.building_id || !newUnit.number.trim() || !newUnit.area_m2 || !tenantId) {
      setError("Torre, numero y area son obligatorios");
      return;
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { data, error: err } = await supabase
      .from("units")
      .insert({
        tenant_id: tenantId,
        building_id: newUnit.building_id,
        number: newUnit.number.trim(),
        floor: Number(newUnit.floor) || 1,
        unit_type: newUnit.unit_type,
        area_m2: Number(newUnit.area_m2),
      })
      .select("id, building_id, number, floor, unit_type, area_m2, coefficient")
      .single();

    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data) {
      setUnits((prev) => [
        ...prev,
        { ...data, area_m2: Number(data.area_m2), coefficient: Number(data.coefficient) },
      ]);
      setNewUnit((prev) => ({ ...prev, number: "", floor: "1", area_m2: "" }));
    }
  };

  const removeUnit = async (id: string) => {
    const supabase = createClient();
    await supabase.from("units").delete().eq("id", id);
    setUnits((prev) => prev.filter((u) => u.id !== id));
  };

  // -- Step 3: Save bank + finish --------------------------------------------

  const saveStep3 = async () => {
    if (!bankName.trim() || !accountNumber.trim()) {
      setError("Nombre del banco y numero de cuenta son obligatorios");
      return false;
    }

    setSaving(true);
    setError(null);
    const supabase = createClient();

    const { error: bankErr } = await supabase
      .from("bank_accounts")
      .insert({
        tenant_id: tenantId,
        bank_name: bankName.trim(),
        account_number: accountNumber.trim(),
        account_type: accountType,
        is_default: true,
        is_active: true,
      });

    if (bankErr) {
      setSaving(false);
      setError(bankErr.message);
      return false;
    }

    // Mark onboarding complete
    const { error: finishErr } = await supabase
      .from("tenants")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", tenantId);

    setSaving(false);
    if (finishErr) {
      setError(finishErr.message);
      return false;
    }
    return true;
  };

  // -- Navigation ------------------------------------------------------------

  const autoDistributeCoefficients = async () => {
    if (units.length === 0 || !tenantId) return;
    const allZero = units.every((u) => u.coefficient === 0);
    if (!allZero) return;

    const values = distributeEqually(units.length);
    const supabase = createClient();
    await Promise.all(
      units.map((u, i) =>
        supabase.from("units").update({ coefficient: values[i] }).eq("id", u.id)
      )
    );
    setUnits((prev) =>
      prev.map((u, i) => ({ ...u, coefficient: values[i] }))
    );
  };

  const handleNext = async () => {
    setError(null);
    if (step === 1) {
      const ok = await saveStep1();
      if (ok) setStep(2);
    } else if (step === 2) {
      if (buildings.length === 0) {
        setError("Agrega al menos una torre o bloque");
        return;
      }
      if (units.length === 0) {
        setError("Agrega al menos una unidad");
        return;
      }
      setSaving(true);
      await autoDistributeCoefficients();
      setSaving(false);
      setStep(3);
    } else if (step === 3) {
      const ok = await saveStep3();
      if (ok) router.push("/dashboard/overview");
    }
  };

  const handleBack = () => {
    setError(null);
    setStep((prev) => Math.max(1, prev - 1));
  };

  // -- Validation checks -----------------------------------------------------

  const step1Valid = tenant.name.trim().length > 0 && tenant.nit.trim().length >= 9 && tenant.address.trim().length > 0;
  const step2Valid = buildings.length > 0 && units.length > 0;
  const step3Valid = bankName.trim().length > 0 && accountNumber.trim().length > 0;

  const canProceed = step === 1 ? step1Valid : step === 2 ? step2Valid : step3Valid;

  usePageTransition(containerRef, { ready: !loading });

  // -- Loading ---------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Cargando configuracion...</span>
        </div>
      </div>
    );
  }

  // -- Render ----------------------------------------------------------------

  return (
    <div ref={containerRef} className="mx-auto max-w-2xl py-8">
      {/* Header */}
      <div className="anim-header mb-8 text-center">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-base font-bold text-background">
          K
        </div>
        <h1 className="text-lg font-semibold tracking-tight">
          Configuracion inicial
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Configura los datos basicos de tu conjunto para empezar a operar.
        </p>
      </div>

      {/* Step indicator */}
      <div className="anim-filter mb-8">
        <div className="flex items-center justify-center gap-0">
          {STEPS.map((s, idx) => {
            const isActive = step === s.num;
            const isCompleted = step > s.num;
            const Icon = s.icon;

            return (
              <div key={s.num} className="flex items-center">
                {idx > 0 && (
                  <div
                    className={`h-px w-12 transition-colors sm:w-20 ${
                      isCompleted ? "bg-emerald-500" : "bg-border"
                    }`}
                  />
                )}
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                      isCompleted
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : isActive
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-medium ${
                      isActive ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2.5 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: Datos del conjunto */}
      {step === 1 && (
        <Card className="anim-card">
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-[15px]">
              Datos del conjunto
            </CardTitle>
            <CardDescription className="text-[13px]">
              Informacion legal y de contacto de la propiedad horizontal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Nombre del conjunto *
                </Label>
                <Input
                  value={tenant.name}
                  onChange={(e) => setTenant((p) => ({ ...p, name: e.target.value }))}
                  className="text-[13px]"
                  placeholder="Conjunto Residencial Los Pinos"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  NIT *
                </Label>
                <Input
                  value={tenant.nit}
                  onChange={(e) => setTenant((p) => ({ ...p, nit: e.target.value }))}
                  className="font-mono text-[13px]"
                  placeholder="901234567"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Estrato
                </Label>
                <Select
                  value={String(tenant.stratum)}
                  onValueChange={(v) => { if (v) setTenant((p) => ({ ...p, stratum: Number(v) })); }}
                >
                  <SelectTrigger className="h-8 w-full text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((s) => (
                      <SelectItem key={s} value={String(s)} className="text-[13px]">
                        Estrato {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Direccion *
                </Label>
                <Input
                  value={tenant.address}
                  onChange={(e) => setTenant((p) => ({ ...p, address: e.target.value }))}
                  className="text-[13px]"
                  placeholder="Calle 127 #45-30"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Ciudad
                </Label>
                <Input
                  value={tenant.city}
                  onChange={(e) => setTenant((p) => ({ ...p, city: e.target.value }))}
                  className="text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Departamento
                </Label>
                <Input
                  value={tenant.department}
                  onChange={(e) => setTenant((p) => ({ ...p, department: e.target.value }))}
                  className="text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Telefono
                </Label>
                <Input
                  value={tenant.phone}
                  onChange={(e) => setTenant((p) => ({ ...p, phone: e.target.value }))}
                  className="font-mono text-[13px]"
                  placeholder="6012345678"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Correo electronico
                </Label>
                <Input
                  type="email"
                  value={tenant.email}
                  onChange={(e) => setTenant((p) => ({ ...p, email: e.target.value }))}
                  className="text-[13px]"
                  placeholder="admin@conjunto.co"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Estructura */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Buildings */}
          <Card className="anim-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-[15px]">Torres / Bloques</CardTitle>
              <CardDescription className="text-[13px]">
                Agrega las torres o bloques del conjunto. Necesitas al menos una.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Nombre
                  </Label>
                  <Input
                    value={newBuildingName}
                    onChange={(e) => setNewBuildingName(e.target.value)}
                    className="text-[13px]"
                    placeholder="Torre A"
                    onKeyDown={(e) => e.key === "Enter" && addBuilding()}
                  />
                </div>
                <div className="w-24 space-y-1.5">
                  <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Pisos
                  </Label>
                  <Input
                    type="number"
                    value={newBuildingFloors}
                    onChange={(e) => setNewBuildingFloors(e.target.value)}
                    className="font-mono text-[13px]"
                    min={1}
                  />
                </div>
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={addBuilding}
                  disabled={saving || !newBuildingName.trim()}
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                </Button>
              </div>

              {buildings.length > 0 && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[11px]">Nombre</TableHead>
                        <TableHead className="w-20 text-center text-[11px]">Pisos</TableHead>
                        <TableHead className="w-10" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {buildings.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell className="text-[13px] font-medium">{b.name}</TableCell>
                          <TableCell className="text-center font-mono text-[13px] tabular-nums">
                            {b.floors}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => removeBuilding(b.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Units */}
          {buildings.length > 0 && (
            <Card className="anim-card">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-[15px]">Unidades</CardTitle>
                <CardDescription className="text-[13px]">
                  Agrega las unidades (apartamentos, locales, etc.). Necesitas al menos una.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-2 space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Torre
                    </Label>
                    <Select
                      value={newUnit.building_id}
                      onValueChange={(v) => { if (v) setNewUnit((p) => ({ ...p, building_id: v })); }}
                    >
                      <SelectTrigger className="h-8 w-full text-[13px]">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {buildings.map((b) => (
                          <SelectItem key={b.id} value={b.id} className="text-[13px]">
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Numero
                    </Label>
                    <Input
                      value={newUnit.number}
                      onChange={(e) => setNewUnit((p) => ({ ...p, number: e.target.value }))}
                      className="font-mono text-[13px]"
                      placeholder="101"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Piso
                    </Label>
                    <Input
                      type="number"
                      value={newUnit.floor}
                      onChange={(e) => setNewUnit((p) => ({ ...p, floor: e.target.value }))}
                      className="font-mono text-[13px]"
                      min={0}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Area m2
                    </Label>
                    <Input
                      type="number"
                      value={newUnit.area_m2}
                      onChange={(e) => setNewUnit((p) => ({ ...p, area_m2: e.target.value }))}
                      className="font-mono text-[13px]"
                      placeholder="75"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Tipo
                    </Label>
                    <Select
                      value={newUnit.unit_type}
                      onValueChange={(v) => { if (v) setNewUnit((p) => ({ ...p, unit_type: v })); }}
                    >
                      <SelectTrigger className="h-8 w-40 text-[13px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(UNIT_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value} className="text-[13px]">
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-auto">
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      onClick={addUnit}
                      disabled={saving || !newUnit.building_id || !newUnit.number.trim()}
                    >
                      {saving ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="mr-1.5 h-3 w-3" />
                      )}
                      Agregar unidad
                    </Button>
                  </div>
                </div>

                {units.length > 0 && (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[11px]">Numero</TableHead>
                          <TableHead className="text-[11px]">Torre</TableHead>
                          <TableHead className="text-[11px]">Tipo</TableHead>
                          <TableHead className="text-center text-[11px]">Piso</TableHead>
                          <TableHead className="text-right text-[11px]">Area</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {units.map((u) => {
                          const bld = buildings.find((b) => b.id === u.building_id);
                          return (
                            <TableRow key={u.id}>
                              <TableCell className="font-mono text-[13px] font-medium tabular-nums">
                                {u.number}
                              </TableCell>
                              <TableCell className="text-[12px] text-muted-foreground">
                                {bld?.name ?? "--"}
                              </TableCell>
                              <TableCell className="text-[12px]">
                                {UNIT_TYPE_LABELS[u.unit_type] ?? u.unit_type}
                              </TableCell>
                              <TableCell className="text-center font-mono text-[12px] tabular-nums">
                                {u.floor}
                              </TableCell>
                              <TableCell className="text-right font-mono text-[12px] tabular-nums">
                                {u.area_m2} m2
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                  onClick={() => removeUnit(u.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {units.length > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {units.length} unidad{units.length !== 1 ? "es" : ""} registrada{units.length !== 1 ? "s" : ""}.
                    Puedes agregar mas unidades despues desde la seccion de Unidades.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Coefficients */}
          {units.length >= 2 && (
            <Card className="anim-card">
              <CardHeader className="pb-3">
                <CardTitle className="font-display text-[15px]">Coeficientes de copropiedad</CardTitle>
                <CardDescription className="text-[13px]">
                  Distribuye los coeficientes entre las unidades. Deben sumar 100% (Ley 675).
                </CardDescription>
              </CardHeader>
              <CardContent>
                {units.every((u) => u.coefficient === 0) && (
                  <div className="mb-3 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Si no configuras los coeficientes ahora, se distribuiran equitativamente al continuar.
                    </span>
                  </div>
                )}
                <CoefficientEditor
                  units={units.map((u) => ({
                    id: u.id,
                    number: u.number,
                    building_name: buildings.find((b) => b.id === u.building_id)?.name ?? "--",
                    unit_type: u.unit_type,
                    coefficient: u.coefficient,
                  }))}
                  onSave={async (updates) => {
                    setCoefficientSaving(true);
                    const supabase = createClient();
                    await Promise.all(
                      updates.map(({ id, coefficient }) =>
                        supabase.from("units").update({ coefficient }).eq("id", id)
                      )
                    );
                    setUnits((prev) =>
                      prev.map((u) => {
                        const upd = updates.find((x) => x.id === u.id);
                        return upd ? { ...u, coefficient: upd.coefficient } : u;
                      })
                    );
                    setCoefficientSaving(false);
                  }}
                  saving={coefficientSaving}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step 3: Cuenta bancaria */}
      {step === 3 && (
        <Card className="anim-card">
          <CardHeader className="pb-4">
            <CardTitle className="font-display text-[15px]">
              Cuenta bancaria principal
            </CardTitle>
            <CardDescription className="text-[13px]">
              Registra la cuenta bancaria donde el conjunto recibe los pagos de cuotas.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Banco *
              </Label>
              <Input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="text-[13px]"
                placeholder="Bancolombia"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Numero de cuenta *
                </Label>
                <Input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="font-mono text-[13px]"
                  placeholder="000-000000-00"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Tipo de cuenta
                </Label>
                <Select
                  value={accountType}
                  onValueChange={(v) => { if (v) setAccountType(v); }}
                >
                  <SelectTrigger className="h-8 w-full text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corriente" className="text-[13px]">
                      Cuenta corriente
                    </SelectItem>
                    <SelectItem value="ahorros" className="text-[13px]">
                      Cuenta de ahorros
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation buttons */}
      <div className="mt-6 flex items-center justify-between">
        <div>
          {step > 1 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleBack}>
              <ArrowLeft className="mr-1.5 h-3 w-3" />
              Atras
            </Button>
          )}
        </div>
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={handleNext}
          disabled={!canProceed || saving}
        >
          {saving ? (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          ) : step === 3 ? (
            <CheckCircle2 className="mr-1.5 h-3 w-3" />
          ) : (
            <ArrowRight className="mr-1.5 h-3 w-3" />
          )}
          {step === 3 ? "Finalizar" : "Siguiente"}
        </Button>
      </div>
    </div>
  );
}
