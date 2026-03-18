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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Save } from "lucide-react";

// -- Schema -----------------------------------------------------------------

const financialSchema = z.object({
  billing_cutoff_day: z.coerce.number().min(1, "Minimo dia 1").max(28, "Maximo dia 28"),
  payment_due_day: z.coerce.number().min(1, "Minimo dia 1").max(28, "Maximo dia 28"),
  late_fee_rate: z.coerce.number().min(0, "No puede ser negativo").max(100, "Maximo 100%"),
  grace_period_days: z.coerce.number().min(0, "No puede ser negativo").max(30, "Maximo 30 dias"),
  late_fee_type: z.enum(["simple", "compound"]),
});

type FinancialFormData = z.infer<typeof financialSchema>;

const SETTING_KEYS: SettingKey[] = [
  "billing_cutoff_day",
  "payment_due_day",
  "late_fee_rate",
  "grace_period_days",
  "late_fee_type",
];

// -- Component --------------------------------------------------------------

export default function FinancialSettingsPage() {
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
  } = useForm<FinancialFormData>({
    resolver: zodResolver(financialSchema),
  });

  const watchedLateType = watch("late_fee_type");

  // -- Fetch settings -------------------------------------------------------

  const fetchData = useCallback(async () => {
    const settings = await getSettings(SETTING_KEYS);
    reset({
      billing_cutoff_day: Number(settings.billing_cutoff_day),
      payment_due_day: Number(settings.payment_due_day),
      late_fee_rate: Number(settings.late_fee_rate),
      grace_period_days: Number(settings.grace_period_days),
      late_fee_type: settings.late_fee_type as "simple" | "compound",
    });
    setLoading(false);
  }, [reset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -- Save -----------------------------------------------------------------

  async function onSave(data: FinancialFormData) {
    setIsSubmitting(true);
    setFeedback(null);

    const { error } = await saveSettings({
      billing_cutoff_day: String(data.billing_cutoff_day),
      payment_due_day: String(data.payment_due_day),
      late_fee_rate: String(data.late_fee_rate),
      grace_period_days: String(data.grace_period_days),
      late_fee_type: data.late_fee_type,
    });

    setIsSubmitting(false);

    if (error) {
      setFeedback({ type: "error", message: error });
      return;
    }

    setFeedback({ type: "success", message: "Configuracion financiera guardada" });
    fetchData();
    setTimeout(() => setFeedback(null), 3000);
  }

  // -- Loading --------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-48 animate-pulse rounded bg-muted" />
        <div className="h-52 animate-pulse rounded-xl bg-muted/40 ring-1 ring-foreground/5" />
      </div>
    );
  }

  // -- Render ---------------------------------------------------------------

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-6">
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

      {/* Billing Cycle */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Ciclo de facturacion</CardTitle>
          <CardDescription>
            Define los dias de corte y vencimiento de las cuotas de administracion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="billing_cutoff_day">Dia de corte</Label>
              <Input
                id="billing_cutoff_day"
                type="number"
                min={1}
                max={28}
                {...register("billing_cutoff_day")}
                aria-invalid={!!errors.billing_cutoff_day}
              />
              <p className="text-[11px] text-muted-foreground">
                Dia del mes en que se genera la factura (1-28)
              </p>
              {errors.billing_cutoff_day && (
                <p className="text-xs text-destructive">
                  {errors.billing_cutoff_day.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment_due_day">Dia limite de pago</Label>
              <Input
                id="payment_due_day"
                type="number"
                min={1}
                max={28}
                {...register("payment_due_day")}
                aria-invalid={!!errors.payment_due_day}
              />
              <p className="text-[11px] text-muted-foreground">
                Dia del mes en que vence el pago (1-28)
              </p>
              {errors.payment_due_day && (
                <p className="text-xs text-destructive">
                  {errors.payment_due_day.message}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Late Fees */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Intereses de mora</CardTitle>
          <CardDescription>
            Configuracion de la tasa de interes y el periodo de gracia para pagos vencidos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="late_fee_rate">Tasa de mora (%)</Label>
              <Input
                id="late_fee_rate"
                type="number"
                step="0.01"
                min="0"
                max="100"
                {...register("late_fee_rate")}
                aria-invalid={!!errors.late_fee_rate}
              />
              <p className="text-[11px] text-muted-foreground">
                Porcentaje mensual de interes por mora
              </p>
              {errors.late_fee_rate && (
                <p className="text-xs text-destructive">
                  {errors.late_fee_rate.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="grace_period_days">Periodo de gracia (dias)</Label>
              <Input
                id="grace_period_days"
                type="number"
                min={0}
                max={30}
                {...register("grace_period_days")}
                aria-invalid={!!errors.grace_period_days}
              />
              <p className="text-[11px] text-muted-foreground">
                Dias despues del vencimiento sin cobrar mora
              </p>
              {errors.grace_period_days && (
                <p className="text-xs text-destructive">
                  {errors.grace_period_days.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de interes</Label>
              <Select
                value={watchedLateType}
                onValueChange={(val) =>
                  setValue(
                    "late_fee_type",
                    val as "simple" | "compound",
                    { shouldValidate: true, shouldDirty: true }
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple</SelectItem>
                  <SelectItem value="compound">Compuesto</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Simple: sobre capital. Compuesto: sobre saldo.
              </p>
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
