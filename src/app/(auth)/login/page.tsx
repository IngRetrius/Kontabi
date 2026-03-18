"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LockKeyhole, Mail, ArrowRight, AlertCircle } from "lucide-react";

const loginSchema = z.object({
  email: z.email("Ingresa un correo valido"),
  password: z.string().min(6, "La contrasena debe tener al menos 6 caracteres"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginFormData) {
    setIsLoading(true);
    setServerError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      setServerError(
        error.message === "Invalid login credentials"
          ? "Correo o contrasena incorrectos"
          : error.message
      );
      setIsLoading(false);
      return;
    }

    router.push("/dashboard/overview");
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
      {/* Left branded panel */}
      <div className="relative hidden overflow-hidden bg-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Architectural grid lines */}
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.04]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="grid"
              width="60"
              height="60"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 60 0 L 0 0 0 60"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.8"
                className="text-background"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Diagonal accent line */}
        <div className="absolute -right-32 top-1/4 h-px w-[600px] rotate-[35deg] bg-gradient-to-r from-transparent via-background/20 to-transparent" />
        <div className="absolute -left-16 bottom-1/3 h-px w-[400px] rotate-[35deg] bg-gradient-to-r from-transparent via-background/10 to-transparent" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-background/20 bg-background/10 text-sm font-bold tracking-tight text-background">
              K
            </div>
            <span className="text-lg font-semibold tracking-tight text-background">
              Kontabi
            </span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <blockquote className="space-y-4">
            <p className="max-w-sm text-[1.35rem] font-medium leading-relaxed tracking-tight text-background/90">
              Gestion financiera clara para propiedad horizontal.
            </p>
            <p className="max-w-xs text-sm leading-relaxed text-background/50">
              Contabilidad NIIF Grupo 3, presupuestos, cartera e indicadores
              financieros en un solo lugar.
            </p>
          </blockquote>

          <div className="flex gap-8 border-t border-background/10 pt-6">
            <div>
              <div className="text-2xl font-semibold tabular-nums text-background/80">
                100K+
              </div>
              <div className="mt-0.5 text-xs text-background/40">
                Copropiedades en Colombia
              </div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums text-background/80">
                Ley 675
              </div>
              <div className="mt-0.5 text-xs text-background/40">
                Cumplimiento automatico
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        {/* Mobile brand */}
        <div className="mb-10 flex items-center gap-2.5 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-sm font-bold text-background">
            K
          </div>
          <span className="text-lg font-semibold tracking-tight">Kontabi</span>
        </div>

        <div className="w-full max-w-[380px]">
          <div className="mb-8 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Iniciar sesion
            </h1>
            <p className="text-sm text-muted-foreground">
              Ingresa tus credenciales para acceder al panel
            </p>
          </div>

          {serverError && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Correo electronico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@conjunto.co"
                  autoComplete="email"
                  className="h-10 pl-10"
                  aria-invalid={!!errors.email}
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contrasena</Label>
              </div>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Tu contrasena"
                  autoComplete="current-password"
                  className="h-10 pl-10"
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Ingresando...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm text-muted-foreground">
            No tienes una cuenta?{" "}
            <Link
              href="/register"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Registrate aqui
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
