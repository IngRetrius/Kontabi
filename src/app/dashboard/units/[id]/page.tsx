"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { formatCoefficient, formatShortDate } from "@/lib/utils/format";
import type { Building, UnitType, Owner } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  ArrowLeft,
  Pencil,
  UserPlus,
  Home,
  Store,
  Car,
  Package,
  Mail,
  Phone,
  Calendar,
  User,
  Building2,
  Layers,
  Maximize2,
  Percent,
  AlertCircle,
  Power,
  History,
} from "lucide-react";

// -- Types ------------------------------------------------------------------

interface UnitDetail {
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
  building: { id: string; name: string; floors: number };
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

const DOC_TYPE_LABELS: Record<string, string> = {
  cc: "C.C.",
  ce: "C.E.",
  nit: "NIT",
  passport: "Pasaporte",
};

const DOC_TYPE_OPTIONS = [
  { value: "cc", label: "Cedula de Ciudadania" },
  { value: "ce", label: "Cedula de Extranjeria" },
  { value: "nit", label: "NIT" },
  { value: "passport", label: "Pasaporte" },
] as const;

// -- Zod Schemas ------------------------------------------------------------

const ownerSchema = z.object({
  full_name: z.string().min(1, "El nombre es requerido"),
  document_type: z.enum(["cc", "ce", "nit", "passport"]),
  document_number: z.string().min(1, "El numero de documento es requerido"),
  email: z.union([z.string().email("Email invalido"), z.literal("")]),
  phone: z.string(),
  start_date: z.string().min(1, "La fecha de inicio es requerida"),
});

type OwnerFormData = z.infer<typeof ownerSchema>;

const editUnitSchema = z.object({
  building_id: z.string().min(1, "Selecciona una torre"),
  number: z.string().min(1, "El numero es requerido"),
  floor: z.coerce.number().min(0, "El piso debe ser 0 o mayor"),
  unit_type: z.enum(["apartment", "commercial", "parking", "storage"]),
  area_m2: z.coerce.number().positive("El area debe ser mayor a 0"),
  coefficient: z.coerce
    .number()
    .min(0, "El coeficiente debe ser 0 o mayor")
    .max(100, "El coeficiente no puede superar 100"),
});

type EditUnitFormData = z.infer<typeof editUnitSchema>;

// -- Helpers ----------------------------------------------------------------

function displayDate(dateStr: string): string {
  return formatShortDate(new Date(dateStr + "T00:00:00"));
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

// -- Component --------------------------------------------------------------

export default function UnitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const unitId = params.id as string;

  // Data
  const [unit, setUnit] = useState<UnitDetail | null>(null);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Dialogs
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [showEditUnit, setShowEditUnit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Owner form
  const ownerForm = useForm<OwnerFormData>({
    resolver: zodResolver(ownerSchema),
    defaultValues: {
      full_name: "",
      document_type: "cc",
      document_number: "",
      email: "",
      phone: "",
      start_date: todayISO(),
    },
  });

  // Edit unit form
  const editForm = useForm<EditUnitFormData>({
    resolver: zodResolver(editUnitSchema),
  });

  // -- Data fetching --------------------------------------------------------

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    const [unitRes, ownersRes, buildingsRes] = await Promise.all([
      supabase
        .from("units")
        .select("*, building:buildings(id, name, floors)")
        .eq("id", unitId)
        .single(),
      supabase
        .from("owners")
        .select("*")
        .eq("unit_id", unitId)
        .order("is_current", { ascending: false })
        .order("start_date", { ascending: false }),
      supabase.from("buildings").select("*").order("name"),
    ]);

    if (unitRes.error || !unitRes.data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setUnit(unitRes.data as unknown as UnitDetail);
    setOwners(ownersRes.data ?? []);
    setBuildings(buildingsRes.data ?? []);
    setLoading(false);
  }, [unitId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -- Derived data ---------------------------------------------------------

  const currentOwner = owners.find((o) => o.is_current) ?? null;
  const previousOwners = owners.filter((o) => !o.is_current);

  // -- Handlers -------------------------------------------------------------

  async function getTenantId(): Promise<string | null> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_id", user.id)
      .single();

    return userData?.tenant_id ?? null;
  }

  async function onAddOwner(data: OwnerFormData) {
    setIsSubmitting(true);
    setSubmitError(null);
    const supabase = createClient();

    const tenantId = await getTenantId();
    if (!tenantId) {
      setSubmitError("No se encontro el tenant");
      setIsSubmitting(false);
      return;
    }

    // Deactivate current owner if exists
    if (currentOwner) {
      const { error: deactivateErr } = await supabase
        .from("owners")
        .update({ is_current: false, end_date: data.start_date })
        .eq("id", currentOwner.id);

      if (deactivateErr) {
        setSubmitError(
          "Error al desactivar propietario anterior: " +
            deactivateErr.message
        );
        setIsSubmitting(false);
        return;
      }
    }

    // Insert new owner
    const { error } = await supabase.from("owners").insert({
      tenant_id: tenantId,
      unit_id: unitId,
      full_name: data.full_name,
      document_type: data.document_type,
      document_number: data.document_number,
      email: data.email || null,
      phone: data.phone || null,
      is_current: true,
      start_date: data.start_date,
    });

    if (error) {
      setSubmitError(error.message);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    setShowAddOwner(false);
    ownerForm.reset({
      full_name: "",
      document_type: "cc",
      document_number: "",
      email: "",
      phone: "",
      start_date: todayISO(),
    });
    fetchData();
  }

  async function onEditUnit(data: EditUnitFormData) {
    setIsSubmitting(true);
    setSubmitError(null);
    const supabase = createClient();

    const { error } = await supabase
      .from("units")
      .update({
        building_id: data.building_id,
        number: data.number,
        floor: data.floor,
        unit_type: data.unit_type,
        area_m2: data.area_m2,
        coefficient: data.coefficient,
      })
      .eq("id", unitId);

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
    setShowEditUnit(false);
    fetchData();
  }

  async function toggleActive() {
    if (!unit) return;
    const supabase = createClient();
    await supabase
      .from("units")
      .update({ is_active: !unit.is_active })
      .eq("id", unitId);
    fetchData();
  }

  function openEditDialog() {
    if (!unit) return;
    editForm.reset({
      building_id: unit.building_id,
      number: unit.number,
      floor: unit.floor,
      unit_type: unit.unit_type,
      area_m2: unit.area_m2,
      coefficient: unit.coefficient,
    });
    setSubmitError(null);
    setShowEditUnit(true);
  }

  // -- Loading state --------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded bg-muted" />
          <div className="space-y-1.5">
            <div className="h-5 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-52 animate-pulse rounded-xl bg-muted/40 ring-1 ring-foreground/5" />
          <div className="h-52 animate-pulse rounded-xl bg-muted/40 ring-1 ring-foreground/5" />
        </div>
      </div>
    );
  }

  // -- Not found state ------------------------------------------------------

  if (notFound || !unit) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <div className="rounded-full bg-muted p-4">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold">Unidad no encontrada</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            La unidad que buscas no existe o no tienes acceso.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/units")}
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Volver a unidades
        </Button>
      </div>
    );
  }

  // -- Render ---------------------------------------------------------------

  const TypeIcon = UNIT_TYPE_ICONS[unit.unit_type];

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            className="mt-0.5 shrink-0"
            onClick={() => router.push("/dashboard/units")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold tracking-tight">
                Unidad {unit.number}
              </h2>
              <Badge
                variant={unit.is_active ? "default" : "destructive"}
                className="text-[10px]"
              >
                {unit.is_active ? "Activa" : "Inactiva"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {unit.building?.name} &middot; Piso {unit.floor}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleActive}>
            <Power className="mr-1.5 h-3.5 w-3.5" />
            {unit.is_active ? "Desactivar" : "Activar"}
          </Button>
          <Button variant="outline" size="sm" onClick={openEditDialog}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setSubmitError(null);
              setShowAddOwner(true);
            }}
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            Asignar propietario
          </Button>
        </div>
      </div>

      {/* ---- Info Cards ---- */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Unit Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Informacion de la unidad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <InfoItem
                icon={<TypeIcon className="h-3.5 w-3.5" />}
                label="Tipo"
                value={UNIT_TYPE_LABELS[unit.unit_type]}
              />
              <InfoItem
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="Torre"
                value={unit.building?.name ?? "--"}
              />
              <InfoItem
                icon={<Layers className="h-3.5 w-3.5" />}
                label="Piso"
                value={String(unit.floor)}
                mono
              />
              <InfoItem
                icon={<Maximize2 className="h-3.5 w-3.5" />}
                label="Area"
              >
                <span className="text-sm font-medium tabular-nums">
                  {unit.area_m2.toFixed(2)} m
                  <sup className="text-[9px]">2</sup>
                </span>
              </InfoItem>
              <InfoItem
                icon={<Percent className="h-3.5 w-3.5" />}
                label="Coeficiente"
              >
                <span className="text-sm font-medium font-mono tabular-nums">
                  {formatCoefficient(Number(unit.coefficient))}%
                </span>
              </InfoItem>
              <InfoItem
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Creada"
                value={formatShortDate(new Date(unit.created_at))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Current Owner */}
        <Card
          className={
            currentOwner
              ? "border-l-[3px] border-l-emerald-500 dark:border-l-emerald-600"
              : ""
          }
        >
          <CardHeader>
            <CardTitle className="text-sm">Propietario actual</CardTitle>
            {currentOwner && (
              <CardAction>
                <Badge
                  variant="outline"
                  className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                >
                  Vigente
                </Badge>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {currentOwner ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40">
                    <User className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {currentOwner.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {DOC_TYPE_LABELS[currentOwner.document_type]}{" "}
                      {currentOwner.document_number}
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-1.5">
                  {currentOwner.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate text-xs">
                        {currentOwner.email}
                      </span>
                    </div>
                  )}
                  {currentOwner.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="text-xs">{currentOwner.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span className="text-xs">
                      Desde {displayDate(currentOwner.start_date)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="rounded-full bg-muted p-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Sin propietario asignado
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground/70">
                    Asigna un propietario a esta unidad
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSubmitError(null);
                    setShowAddOwner(true);
                  }}
                >
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                  Asignar propietario
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---- Owner History ---- */}
      {previousOwners.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <History className="h-4 w-4 text-muted-foreground" />
              Historial de propietarios
              <Badge variant="secondary" className="text-[10px]">
                {previousOwners.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto border-t">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      Nombre
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      Documento
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      Contacto
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                      Periodo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previousOwners.map((owner) => (
                    <tr
                      key={owner.id}
                      className="border-b last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-4 py-2.5 font-medium">
                        {owner.full_name}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {DOC_TYPE_LABELS[owner.document_type]}{" "}
                        {owner.document_number}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {owner.email || owner.phone || "--"}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-xs text-muted-foreground">
                        {displayDate(owner.start_date)}
                        {" - "}
                        {owner.end_date ? displayDate(owner.end_date) : "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---- Add Owner Dialog ---- */}
      <Dialog
        open={showAddOwner}
        onOpenChange={(open) => {
          setShowAddOwner(open);
          if (!open) {
            ownerForm.reset();
            setSubmitError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar propietario</DialogTitle>
            <DialogDescription>
              {currentOwner
                ? `El propietario actual (${currentOwner.full_name}) sera marcado como anterior.`
                : "Registra el propietario de esta unidad."}
            </DialogDescription>
          </DialogHeader>

          {submitError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <form
            onSubmit={ownerForm.handleSubmit(onAddOwner)}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="owner-name">Nombre completo</Label>
              <Input
                id="owner-name"
                placeholder="Juan Perez Garcia"
                {...ownerForm.register("full_name")}
                aria-invalid={!!ownerForm.formState.errors.full_name}
              />
              {ownerForm.formState.errors.full_name && (
                <p className="text-xs text-destructive">
                  {ownerForm.formState.errors.full_name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-[140px_1fr] gap-3">
              <div className="space-y-1.5">
                <Label>Tipo doc.</Label>
                <Select
                  value={ownerForm.watch("document_type")}
                  onValueChange={(val) =>
                    ownerForm.setValue(
                      "document_type",
                      val as OwnerFormData["document_type"],
                      { shouldValidate: true }
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="owner-doc-number">Numero de documento</Label>
                <Input
                  id="owner-doc-number"
                  placeholder="1234567890"
                  {...ownerForm.register("document_number")}
                  aria-invalid={
                    !!ownerForm.formState.errors.document_number
                  }
                />
                {ownerForm.formState.errors.document_number && (
                  <p className="text-xs text-destructive">
                    {ownerForm.formState.errors.document_number.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="owner-email">Email</Label>
                <Input
                  id="owner-email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  {...ownerForm.register("email")}
                  aria-invalid={!!ownerForm.formState.errors.email}
                />
                {ownerForm.formState.errors.email && (
                  <p className="text-xs text-destructive">
                    {ownerForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="owner-phone">Telefono</Label>
                <Input
                  id="owner-phone"
                  placeholder="300 123 4567"
                  {...ownerForm.register("phone")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="owner-start-date">Fecha de inicio</Label>
              <Input
                id="owner-start-date"
                type="date"
                {...ownerForm.register("start_date")}
                aria-invalid={!!ownerForm.formState.errors.start_date}
              />
              {ownerForm.formState.errors.start_date && (
                <p className="text-xs text-destructive">
                  {ownerForm.formState.errors.start_date.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Guardando...
                  </span>
                ) : (
                  "Asignar propietario"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---- Edit Unit Dialog ---- */}
      <Dialog
        open={showEditUnit}
        onOpenChange={(open) => {
          setShowEditUnit(open);
          if (!open) {
            editForm.reset();
            setSubmitError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar unidad</DialogTitle>
            <DialogDescription>
              Modifica los datos de la unidad {unit.number}
            </DialogDescription>
          </DialogHeader>

          {submitError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <form
            onSubmit={editForm.handleSubmit(onEditUnit)}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label>Torre</Label>
              <Select
                value={editForm.watch("building_id")}
                onValueChange={(val) =>
                  editForm.setValue("building_id", val as string, {
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
              {editForm.formState.errors.building_id && (
                <p className="text-xs text-destructive">
                  {editForm.formState.errors.building_id.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-number">Numero</Label>
                <Input
                  id="edit-number"
                  {...editForm.register("number")}
                  aria-invalid={!!editForm.formState.errors.number}
                />
                {editForm.formState.errors.number && (
                  <p className="text-xs text-destructive">
                    {editForm.formState.errors.number.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-floor">Piso</Label>
                <Input
                  id="edit-floor"
                  type="number"
                  min={0}
                  {...editForm.register("floor")}
                  aria-invalid={!!editForm.formState.errors.floor}
                />
                {editForm.formState.errors.floor && (
                  <p className="text-xs text-destructive">
                    {editForm.formState.errors.floor.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tipo de unidad</Label>
              <Select
                value={editForm.watch("unit_type")}
                onValueChange={(val) =>
                  editForm.setValue("unit_type", val as UnitType, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-area">
                  Area m<sup>2</sup>
                </Label>
                <Input
                  id="edit-area"
                  type="number"
                  step="0.01"
                  min="0.01"
                  {...editForm.register("area_m2")}
                  aria-invalid={!!editForm.formState.errors.area_m2}
                />
                {editForm.formState.errors.area_m2 && (
                  <p className="text-xs text-destructive">
                    {editForm.formState.errors.area_m2.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-coefficient">Coeficiente</Label>
                <Input
                  id="edit-coefficient"
                  type="number"
                  step="0.000001"
                  min="0"
                  max="100"
                  {...editForm.register("coefficient")}
                  aria-invalid={!!editForm.formState.errors.coefficient}
                />
                {editForm.formState.errors.coefficient && (
                  <p className="text-xs text-destructive">
                    {editForm.formState.errors.coefficient.message}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Guardando...
                  </span>
                ) : (
                  "Guardar cambios"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// -- Sub-components ---------------------------------------------------------

function InfoItem({
  icon,
  label,
  value,
  mono,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      {children ?? (
        <p
          className={`text-sm font-medium ${mono ? "font-mono tabular-nums" : ""}`}
        >
          {value}
        </p>
      )}
    </div>
  );
}
