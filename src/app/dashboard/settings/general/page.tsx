"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { usePageTransition } from "@/hooks/use-page-transition";
import type { Tenant } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Save } from "lucide-react";

// -- Schema -----------------------------------------------------------------

const generalSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  nit: z.string().min(1, "El NIT es requerido"),
  address: z.string().min(1, "La direccion es requerida"),
  city: z.string().min(1, "La ciudad es requerida"),
  department: z.string().min(1, "El departamento es requerido"),
  stratum: z.coerce.number().min(1, "Minimo estrato 1").max(6, "Maximo estrato 6"),
  phone: z.string(),
  email: z.union([z.string().email("Email invalido"), z.literal("")]),
});

type GeneralFormData = z.infer<typeof generalSchema>;

// -- Component --------------------------------------------------------------

export default function GeneralSettingsPage() {
  const containerRef = useRef<HTMLFormElement>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<GeneralFormData>({
    resolver: zodResolver(generalSchema),
  });

  const watchedStratum = watch("stratum");

  // -- Fetch tenant data ----------------------------------------------------

  const fetchTenant = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.from("tenants").select("*").single();

    if (data) {
      setTenant(data);
      reset({
        name: data.name,
        nit: data.nit,
        address: data.address,
        city: data.city,
        department: data.department,
        stratum: data.stratum,
        phone: data.phone ?? "",
        email: data.email ?? "",
      });
    }
    setLoading(false);
  }, [reset]);

  useEffect(() => {
    fetchTenant();
  }, [fetchTenant]);

  // -- Save -----------------------------------------------------------------

  async function onSave(data: GeneralFormData) {
    if (!tenant) return;
    setIsSubmitting(true);
    setFeedback(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("tenants")
      .update({
        name: data.name,
        nit: data.nit,
        address: data.address,
        city: data.city,
        department: data.department,
        stratum: data.stratum,
        phone: data.phone || null,
        email: data.email || null,
      })
      .eq("id", tenant.id);

    setIsSubmitting(false);

    if (error) {
      setFeedback({ type: "error", message: error.message });
      return;
    }

    setFeedback({ type: "success", message: "Configuracion guardada" });
    fetchTenant();
    setTimeout(() => setFeedback(null), 3000);
  }

  usePageTransition(containerRef as React.RefObject<HTMLDivElement | null>, { ready: !loading });

  // -- Loading --------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-40 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted/40 ring-1 ring-foreground/5" />
      </div>
    );
  }

  // -- Render ---------------------------------------------------------------

  return (
    <form ref={containerRef} onSubmit={handleSubmit(onSave)} className="space-y-6">
      {/* Feedback */}
      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
              : "border-destructive/20 bg-destructive/5 text-destructive"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {feedback.message}
        </div>
      )}

      {/* Identity */}
      <Card className="anim-card">
        <CardHeader>
          <CardTitle className="font-display text-sm">Identidad del conjunto</CardTitle>
          <CardDescription>
            Nombre, NIT y datos de identificacion legal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre del conjunto</Label>
              <Input
                id="name"
                placeholder="Conjunto Residencial Los Pinos"
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
              <Label htmlFor="nit">NIT</Label>
              <Input
                id="nit"
                placeholder="900123456-7"
                {...register("nit")}
                aria-invalid={!!errors.nit}
              />
              {errors.nit && (
                <p className="text-xs text-destructive">
                  {errors.nit.message}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card className="anim-card">
        <CardHeader>
          <CardTitle className="font-display text-sm">Ubicacion</CardTitle>
          <CardDescription>
            Direccion y datos geograficos del conjunto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="address">Direccion</Label>
            <Input
              id="address"
              placeholder="Calle 123 # 45 - 67"
              {...register("address")}
              aria-invalid={!!errors.address}
            />
            {errors.address && (
              <p className="text-xs text-destructive">
                {errors.address.message}
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="city">Ciudad</Label>
              <Input
                id="city"
                placeholder="Bogota"
                {...register("city")}
                aria-invalid={!!errors.city}
              />
              {errors.city && (
                <p className="text-xs text-destructive">
                  {errors.city.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="department">Departamento</Label>
              <Input
                id="department"
                placeholder="Cundinamarca"
                {...register("department")}
                aria-invalid={!!errors.department}
              />
              {errors.department && (
                <p className="text-xs text-destructive">
                  {errors.department.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Estrato</Label>
              <Select
                value={String(watchedStratum ?? "")}
                onValueChange={(val) =>
                  setValue("stratum", Number(val), { shouldValidate: true, shouldDirty: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Estrato" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      Estrato {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.stratum && (
                <p className="text-xs text-destructive">
                  {errors.stratum.message}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card className="anim-card">
        <CardHeader>
          <CardTitle className="font-display text-sm">Contacto</CardTitle>
          <CardDescription>
            Telefono y correo de la administracion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefono</Label>
              <Input
                id="phone"
                placeholder="(601) 234 5678"
                {...register("phone")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@conjunto.com"
                {...register("email")}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" size="sm" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Guardando...
              </span>
            ) : (
              <>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Guardar cambios
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
