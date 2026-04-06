"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { getSettings, saveSettings } from "@/lib/settings/tenant-settings";
import type { SettingKey } from "@/types/database";
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
import { AlertCircle, CheckCircle2, Save } from "lucide-react";

// -- Schema -----------------------------------------------------------------

const notificationsSchema = z.object({
  invoice_advance_days: z
    .number()
    .min(0, "No puede ser negativo")
    .max(30, "Maximo 30 dias"),
  overdue_reminder_days: z
    .number()
    .min(1, "Minimo 1 dia")
    .max(30, "Maximo 30 dias"),
});

type NotificationsFormData = z.infer<typeof notificationsSchema>;

const SETTING_KEYS: SettingKey[] = [
  "invoice_advance_days",
  "overdue_reminder_days",
];

// -- Component --------------------------------------------------------------

export default function NotificationsSettingsPage() {
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
    formState: { errors, isDirty },
  } = useForm<NotificationsFormData>({
    resolver: zodResolver(notificationsSchema),
  });

  const fetchData = useCallback(async () => {
    const settings = await getSettings(SETTING_KEYS);
    reset({
      invoice_advance_days: Number(settings.invoice_advance_days),
      overdue_reminder_days: Number(settings.overdue_reminder_days),
    });
    setLoading(false);
  }, [reset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function onSave(data: NotificationsFormData) {
    setIsSubmitting(true);
    setFeedback(null);

    const { error } = await saveSettings({
      invoice_advance_days: String(data.invoice_advance_days),
      overdue_reminder_days: String(data.overdue_reminder_days),
    });

    setIsSubmitting(false);

    if (error) {
      setFeedback({ type: "error", message: error });
      return;
    }

    setFeedback({
      type: "success",
      message: "Configuracion de notificaciones guardada",
    });
    fetchData();
    setTimeout(() => setFeedback(null), 3000);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-48 animate-pulse rounded bg-muted" />
        <div className="h-44 animate-pulse rounded-xl bg-muted/40 ring-1 ring-foreground/5" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-6">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recordatorios de pago</CardTitle>
          <CardDescription>
            Configura cuando se envian los recordatorios a los propietarios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="invoice_advance_days">
                Dias de anticipacion para cobro
              </Label>
              <Input
                id="invoice_advance_days"
                type="number"
                min={0}
                max={30}
                {...register("invoice_advance_days", { valueAsNumber: true })}
                aria-invalid={!!errors.invoice_advance_days}
              />
              <p className="text-[11px] text-muted-foreground">
                Dias antes del vencimiento para enviar el aviso de cobro
              </p>
              {errors.invoice_advance_days && (
                <p className="text-xs text-destructive">
                  {errors.invoice_advance_days.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="overdue_reminder_days">
                Frecuencia de recordatorio de mora
              </Label>
              <Input
                id="overdue_reminder_days"
                type="number"
                min={1}
                max={30}
                {...register("overdue_reminder_days", { valueAsNumber: true })}
                aria-invalid={!!errors.overdue_reminder_days}
              />
              <p className="text-[11px] text-muted-foreground">
                Cada cuantos dias se envia un recordatorio de pago vencido
              </p>
              {errors.overdue_reminder_days && (
                <p className="text-xs text-destructive">
                  {errors.overdue_reminder_days.message}
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

      {/* Future: email templates */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">
            Plantillas de correo
          </CardTitle>
          <CardDescription>
            La personalizacion de plantillas de correo para cobros, recibos y
            comunicados se habilitara proximamente.
          </CardDescription>
        </CardHeader>
      </Card>
    </form>
  );
}
