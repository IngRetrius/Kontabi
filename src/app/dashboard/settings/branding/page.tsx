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
import { Textarea } from "@/components/ui/textarea";
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

const brandingSchema = z.object({
  report_header_text: z.string(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Debe ser un color hex valido (#RRGGBB)").or(z.literal("")),
  logo_pdf_url: z.string(),
});

type BrandingFormData = z.infer<typeof brandingSchema>;

const SETTING_KEYS: SettingKey[] = [
  "report_header_text",
  "primary_color",
  "logo_pdf_url",
];

// -- Component --------------------------------------------------------------

export default function BrandingSettingsPage() {
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
    formState: { errors, isDirty },
  } = useForm<BrandingFormData>({
    resolver: zodResolver(brandingSchema),
  });

  const watchedColor = watch("primary_color");

  const fetchData = useCallback(async () => {
    const settings = await getSettings(SETTING_KEYS);
    reset({
      report_header_text: settings.report_header_text,
      primary_color: settings.primary_color,
      logo_pdf_url: settings.logo_pdf_url,
    });
    setLoading(false);
  }, [reset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function onSave(data: BrandingFormData) {
    setIsSubmitting(true);
    setFeedback(null);

    const { error } = await saveSettings({
      report_header_text: data.report_header_text,
      primary_color: data.primary_color,
      logo_pdf_url: data.logo_pdf_url,
    });

    setIsSubmitting(false);

    if (error) {
      setFeedback({ type: "error", message: error });
      return;
    }

    setFeedback({ type: "success", message: "Configuracion de marca guardada" });
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

      {/* Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Reportes y documentos</CardTitle>
          <CardDescription>
            Personaliza la apariencia de los reportes PDF generados por el
            sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="report_header_text">
              Texto de encabezado para reportes
            </Label>
            <Textarea
              id="report_header_text"
              rows={2}
              placeholder="Conjunto Residencial Los Pinos - NIT 900.123.456-7"
              {...register("report_header_text")}
            />
            <p className="text-[11px] text-muted-foreground">
              Aparece en la parte superior de recibos, estados de cuenta y reportes PDF
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="logo_pdf_url">URL del logo para PDF</Label>
            <Input
              id="logo_pdf_url"
              placeholder="https://ejemplo.com/logo.png"
              {...register("logo_pdf_url")}
            />
            <p className="text-[11px] text-muted-foreground">
              URL de la imagen del logo que se incluira en los documentos PDF
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Color principal</CardTitle>
          <CardDescription>
            Color utilizado en reportes y documentos oficiales
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="space-y-1.5 flex-1 sm:max-w-xs">
              <Label htmlFor="primary_color">Color hex</Label>
              <Input
                id="primary_color"
                placeholder="#1a1a1a"
                {...register("primary_color")}
                aria-invalid={!!errors.primary_color}
              />
              {errors.primary_color && (
                <p className="text-xs text-destructive">
                  {errors.primary_color.message}
                </p>
              )}
            </div>
            {watchedColor && /^#[0-9a-fA-F]{6}$/.test(watchedColor) && (
              <div
                className="mb-0.5 h-9 w-9 shrink-0 rounded-md border"
                style={{ backgroundColor: watchedColor }}
              />
            )}
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
