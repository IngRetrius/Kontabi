"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import type { Building } from "@/types/database";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Building2, AlertCircle } from "lucide-react";

const buildingSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  floors: z.coerce.number().min(1, "Debe tener al menos 1 piso"),
});

type BuildingFormData = z.infer<typeof buildingSchema>;

interface BuildingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buildings: Building[];
  onUpdate: () => void;
}

export function BuildingsDialog({
  open,
  onOpenChange,
  buildings,
  onUpdate,
}: BuildingsDialogProps) {
  const [editing, setEditing] = useState<Building | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BuildingFormData>({
    resolver: zodResolver(buildingSchema),
  });

  function openCreateForm() {
    setEditing(null);
    reset({ name: "", floors: 1 });
    setShowForm(true);
    setError(null);
  }

  function openEditForm(building: Building) {
    setEditing(building);
    reset({ name: building.name, floors: building.floors });
    setShowForm(true);
    setError(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    reset();
    setError(null);
  }

  async function onSubmit(data: BuildingFormData) {
    setIsSubmitting(true);
    setError(null);
    const supabase = createClient();

    if (editing) {
      const { error: err } = await supabase
        .from("buildings")
        .update({ name: data.name, floors: data.floors })
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

      const { error: err } = await supabase.from("buildings").insert({
        name: data.name,
        floors: data.floors,
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

  async function handleDelete(building: Building) {
    const supabase = createClient();
    const { error: err } = await supabase
      .from("buildings")
      .delete()
      .eq("id", building.id);

    if (err) {
      setError(
        err.message.includes("foreign key")
          ? "No se puede eliminar: tiene unidades asociadas"
          : err.message
      );
      return;
    }
    onUpdate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gestionar torres</DialogTitle>
          <DialogDescription>
            Administra las torres o bloques del conjunto
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-2">
          {buildings.length === 0 && !showForm && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No hay torres registradas. Agrega la primera torre.
            </p>
          )}

          {buildings.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.floors} {b.floors === 1 ? "piso" : "pisos"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => openEditForm(b)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleDelete(b)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {showForm ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="building-name">Nombre de la torre</Label>
              <Input
                id="building-name"
                placeholder="Torre A"
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
              <Label htmlFor="building-floors">Numero de pisos</Label>
              <Input
                id="building-floors"
                type="number"
                min={1}
                {...register("floors")}
                aria-invalid={!!errors.floors}
              />
              {errors.floors && (
                <p className="text-xs text-destructive">
                  {errors.floors.message}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting
                  ? "Guardando..."
                  : editing
                    ? "Actualizar"
                    : "Crear torre"}
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
            Agregar torre
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
