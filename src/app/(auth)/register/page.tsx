"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Mail,
  LockKeyhole,
  User,
  Building2,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const registerSchema = z
  .object({
    tenantName: z
      .string()
      .min(3, "El nombre debe tener al menos 3 caracteres"),
    fullName: z.string().min(2, "Ingresa tu nombre completo"),
    email: z.email("Ingresa un correo valido"),
    password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contrasenas no coinciden",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterFormData) {
    setIsLoading(true);
    setServerError(null);

    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          tenant_name: data.tenantName,
        },
      },
    });

    if (error) {
      setServerError(error.message);
      setIsLoading(false);
      return;
    }

    router.push("/dashboard/overview");
  }

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

        // Left branded panel
        tl.fromTo(
          ".brand-logo",
          { y: -20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6 }
        )
          .fromTo(
            ".accent-line",
            { scaleX: 0, opacity: 0 },
            {
              scaleX: 1,
              opacity: 1,
              stagger: 0.2,
              duration: 1,
              ease: "power2.inOut",
            },
            0.2
          )
          .fromTo(
            ".brand-quote > *",
            { y: 30, opacity: 0 },
            { y: 0, opacity: 1, stagger: 0.15, duration: 0.7 },
            0.3
          )
          .fromTo(
            ".brand-stat",
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, stagger: 0.1, duration: 0.5 },
            0.6
          );

        // Right form panel
        tl.fromTo(
          ".mobile-brand",
          { y: -15, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5 },
          0.1
        )
          .fromTo(
            ".form-title",
            { y: 20, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.6 },
            0.25
          )
          .fromTo(
            ".form-subtitle",
            { y: 15, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.5 },
            0.35
          )
          .fromTo(
            ".form-field",
            { y: 15, opacity: 0 },
            { y: 0, opacity: 1, stagger: 0.05, duration: 0.45 },
            0.4
          )
          .fromTo(
            ".form-submit",
            { y: 10, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.5 },
            "<0.08"
          )
          .fromTo(
            ".form-link",
            { opacity: 0 },
            { opacity: 1, duration: 0.4 },
            "<0.08"
          );
      });
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className="grid min-h-screen lg:grid-cols-[1fr_1fr] font-body">
      {/* Left branded panel */}
      <div className="relative hidden overflow-hidden bg-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.04]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="grid-reg"
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
          <rect width="100%" height="100%" fill="url(#grid-reg)" />
        </svg>

        <div className="accent-line absolute -right-32 top-1/4 h-px w-[600px] rotate-[35deg] bg-gradient-to-r from-transparent via-background/20 to-transparent origin-left" />
        <div className="accent-line absolute -left-16 bottom-1/3 h-px w-[400px] rotate-[35deg] bg-gradient-to-r from-transparent via-background/10 to-transparent origin-left" />

        <Link href="/" className="brand-logo relative z-10 block w-fit">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-background/20 bg-background/10 text-sm font-bold tracking-tight text-background">
              K
            </div>
            <span className="font-display text-lg tracking-tight text-background">
              Kontabi
            </span>
          </div>
        </Link>

        <div className="relative z-10 space-y-6">
          <div className="brand-quote space-y-4">
            <p className="max-w-sm text-[1.35rem] font-display leading-relaxed tracking-tight text-background/90">
              Comienza a gestionar las finanzas de tu conjunto hoy.
            </p>
            <p className="max-w-xs text-sm leading-relaxed text-background/50">
              Registra tu copropiedad y accede a contabilidad simplificada,
              presupuestos y control de cartera.
            </p>
          </div>

          <div className="flex gap-8 border-t border-background/10 pt-6">
            <div className="brand-stat">
              <div className="text-sm font-medium text-background/70">
                Setup en minutos
              </div>
              <div className="mt-0.5 text-xs text-background/40">
                Sin instalacion
              </div>
            </div>
            <div className="brand-stat">
              <div className="text-sm font-medium text-background/70">
                Plan gratuito
              </div>
              <div className="mt-0.5 text-xs text-background/40">
                Hasta 30 unidades
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <Link href="/" className="mobile-brand mb-10 flex items-center gap-2.5 lg:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground text-sm font-bold text-background">
            K
          </div>
          <span className="font-display text-lg tracking-tight">Kontabi</span>
        </Link>

        <div className="w-full max-w-[380px]">
          <div className="mb-8 space-y-2">
            <h1 className="form-title text-2xl font-display tracking-tight">
              Crear cuenta
            </h1>
            <p className="form-subtitle text-sm text-muted-foreground">
              Registra tu copropiedad para comenzar
            </p>
          </div>

          {serverError && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="form-field space-y-2">
              <Label htmlFor="tenantName">Nombre del conjunto</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="tenantName"
                  placeholder="Conjunto Residencial Los Pinos"
                  className="h-10 pl-10"
                  aria-invalid={!!errors.tenantName}
                  {...register("tenantName")}
                />
              </div>
              {errors.tenantName && (
                <p className="text-xs text-destructive">
                  {errors.tenantName.message}
                </p>
              )}
            </div>

            <div className="form-field space-y-2">
              <Label htmlFor="fullName">Tu nombre completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="fullName"
                  placeholder="Juan Carlos Rodriguez"
                  className="h-10 pl-10"
                  aria-invalid={!!errors.fullName}
                  {...register("fullName")}
                />
              </div>
              {errors.fullName && (
                <p className="text-xs text-destructive">
                  {errors.fullName.message}
                </p>
              )}
            </div>

            <div className="form-field space-y-2">
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

            <div className="form-field space-y-2">
              <Label htmlFor="password">Contrasena</Label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimo 8 caracteres"
                  autoComplete="new-password"
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

            <div className="form-field space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contrasena</Label>
              <div className="relative">
                <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repite tu contrasena"
                  autoComplete="new-password"
                  className="h-10 pl-10"
                  aria-invalid={!!errors.confirmPassword}
                  {...register("confirmPassword")}
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="form-submit w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Creando cuenta...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Crear cuenta
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="form-link mt-8 text-center text-sm text-muted-foreground">
            Ya tienes cuenta?{" "}
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Inicia sesion
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
