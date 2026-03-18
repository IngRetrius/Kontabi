"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import type { CommonArea } from "@/types/database";
import { formatCOP } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Trash2,
  Landmark,
  AlertCircle,
  Users,
  Clock,
  DollarSign,
  ShieldCheck,
} from "lucide-react";

// -- Schema ------------------------------------------------------------------

const commonAreaSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  capacity: z.coerce
    .number()
    .int("Debe ser un numero entero")
    .min(1, "Debe ser al menos 1")
    .optional()
    .or(z.literal("")),
  schedule: z.string().optional(),
  booking_cost: z.coerce.number().min(0, "No puede ser negativo"),
  deposit: z.coerce.number().min(0, "No puede ser negativo"),
  is_bookable: z.boolean(),
});

type CommonAreaFormData = z.infer<typeof commonAreaSchema>;

// -- Props -------------------------------------------------------------------

interface CommonAreasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commonAreas: CommonArea[];
  onUpdate: () => void;
}

// -- Component ---------------------------------------------------------------

export function CommonAreasDialog({
  open,
  onOpenChange,
  commonAreas,
  onUpdate,
}: CommonAreasDialogProps) {
  const [editing, setEditing] = useState<CommonArea | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CommonAreaFormData>({
    resolver: zodResolver(commonAreaSchema),
  });

  function openCreateForm() {
    setEditing(null);
    reset({
      name: "",
      description: "",
      capacity: "" as unknown as number,
      schedule: "",
      booking_cost: 0,
      deposit: 0,
      is_bookable: true,
    });
    setShowForm(true);
    setError(null);
  }

  function openEditForm(area: CommonArea) {
    setEditing(area);
    reset({
      name: area.name,
      description: area.description ?? "",
      capacity: area.capacity ?? ("" as unknown as number),
      schedule: area.schedule ?? "",
      booking_cost: area.booking_cost,
      deposit: area.deposit,
      is_bookable: area.is_bookable,
    });
    setShowForm(true);
    setError(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    reset();
    setError(null);
  }

  async function onSubmit(data: CommonAreaFormData) {
    setIsSubmitting(true);
    setError(null);
    const supabase = createClient();

    const payload = {
      name: data.name,
      description: data.description || null,
      capacity:
        data.capacity && data.capacity !== ("" as unknown)
          ? Number(data.capacity)
          : null,
      schedule: data.schedule || null,
      booking_cost: data.booking_cost,
      deposit: data.deposit,
      is_bookable: data.is_bookable,
    };

    if (editing) {
      const { error: err } = await supabase
        .from("common_areas")
        .update(payload)
        .eq("id", editing.id);
      if (err) {
        setError(err.message);
        setIsSubmitting(false);
        return;
      }
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("No hay sesion activa");
        setIsSubmitting(false);
        return;
      }

      const { data: userData } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("auth_id", user.id)
        .single();

      if (!userData) {
        setError("No se encontro el tenant");
        setIsSubmitting(false);
        return;
      }

      const { error: err } = await supabase.from("common_areas").insert({
        ...payload,
        tenant_id: userData.tenant_id,
      });
      if (err) {
        setError(err.message);
        setIsSubmitting(false);
        return;
      }
    }

    setIsSubmitting(false);
    closeForm();
    onUpdate();
  }

  async function handleDelete(area: CommonArea) {
    const supabase = createClient();
    const { error: err } = await supabase
      .from("common_areas")
      .delete()
      .eq("id", area.id);

    if (err) {
      setError(err.message);
      return;
    }
    onUpdate();
  }

  async function handleToggleActive(area: CommonArea) {
    const supabase = createClient();
    const { error: err } = await supabase
      .from("common_areas")
      .update({ is_active: !area.is_active })
      .eq("id", area.id);

    if (err) {
      setError(err.message);
      return;
    }
    onUpdate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gestionar zonas comunes</DialogTitle>
          <DialogDescription>
            Administra las zonas comunes del conjunto (salon social, piscina,
            gimnasio, etc.)
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          {commonAreas.length === 0 && !showForm && (
            <div className="flex flex-col items-center gap-2 py-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Landmark className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No hay zonas comunes registradas
              </p>
            </div>
          )}

          {commonAreas.map((area) => (
            <div
              key={area.id}
              className={`group rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/30 ${
                !area.is_active ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">
                      {area.name}
                    </span>
                    {!area.is_active && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        Inactiva
                      </Badge>
                    )}
                    {area.is_bookable && area.is_active && (
                      <Badge variant="outline" className="shrink-0 text-xs">
                        Reservable
                      </Badge>
                    )}
                  </div>

                  {area.description && (
                    <p className="pl-6 text-xs leading-relaxed text-muted-foreground line-clamp-1">
                      {area.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 pl-6 text-xs text-muted-foreground/80">
                    {area.capacity != null && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {area.capacity} pers.
                      </span>
                    )}
                    {area.schedule && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {area.schedule}
                      </span>
                    )}
                    {area.booking_cost > 0 && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {formatCOP(area.booking_cost)}
                      </span>
                    )}
                    {area.deposit > 0 && (
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Dep. {formatCOP(area.deposit)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleToggleActive(area)}
                    title={area.is_active ? "Desactivar" : "Activar"}
                  >
                    <span
                      className={`h-2 w-2 rounded-full transition-colors ${
                        area.is_active
                          ? "bg-emerald-500"
                          : "bg-muted-foreground/40"
                      }`}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => openEditForm(area)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleDelete(area)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {showForm ? (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4 rounded-lg border bg-muted/20 p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {editing ? "Editar zona comun" : "Nueva zona comun"}
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="area-name">Nombre</Label>
              <Input
                id="area-name"
                placeholder="Salon social"
                {...register("name")}
                aria-invalid={!!errors.name}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="area-description">Descripcion</Label>
              <Textarea
                id="area-description"
                placeholder="Salon de eventos con cocina y terraza"
                rows={2}
                className="resize-none"
                {...register("description")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="area-capacity">Capacidad</Label>
                <Input
                  id="area-capacity"
                  type="number"
                  min={1}
                  placeholder="50"
                  {...register("capacity")}
                  aria-invalid={!!errors.capacity}
                />
                <p className="text-[11px] text-muted-foreground">Personas</p>
                {errors.capacity && (
                  <p className="text-xs text-destructive">
                    {errors.capacity.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="area-schedule">Horario</Label>
                <Input
                  id="area-schedule"
                  placeholder="Lun-Dom 8am-10pm"
                  {...register("schedule")}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="area-cost">Costo reserva</Label>
                <Input
                  id="area-cost"
                  type="number"
                  min={0}
                  step={1000}
                  {...register("booking_cost")}
                  aria-invalid={!!errors.booking_cost}
                />
                <p className="text-[11px] text-muted-foreground">
                  Valor en COP
                </p>
                {errors.booking_cost && (
                  <p className="text-xs text-destructive">
                    {errors.booking_cost.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="area-deposit">Deposito</Label>
                <Input
                  id="area-deposit"
                  type="number"
                  min={0}
                  step={1000}
                  {...register("deposit")}
                  aria-invalid={!!errors.deposit}
                />
                <p className="text-[11px] text-muted-foreground">
                  Valor en COP
                </p>
                {errors.deposit && (
                  <p className="text-xs text-destructive">
                    {errors.deposit.message}
                  </p>
                )}
              </div>
            </div>

            <label
              htmlFor="area-bookable"
              className="flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 transition-colors hover:bg-muted/40"
            >
              <input
                type="checkbox"
                id="area-bookable"
                className="h-4 w-4 rounded border-input accent-primary"
                {...register("is_bookable")}
              />
              <div>
                <span className="text-sm font-medium">Permite reservas</span>
                <p className="text-[11px] text-muted-foreground">
                  Los residentes podran reservar este espacio
                </p>
              </div>
            </label>

            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Guardando...
                  </span>
                ) : editing ? (
                  "Actualizar"
                ) : (
                  "Crear zona comun"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={closeForm}
              >
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={openCreateForm}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Agregar zona comun
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
