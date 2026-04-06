"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import { usePageTransition } from "@/hooks/use-page-transition";
import type { User, Tenant, UserRole } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertCircle,
  CheckCircle2,
  Save,
  Shield,
  KeyRound,
  Building2,
  Calendar,
  Mail,
} from "lucide-react";

// -- Constants ----------------------------------------------------------------

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  board: "Consejo",
  resident: "Residente",
};

const ROLE_VARIANTS: Record<UserRole, "default" | "secondary" | "outline"> = {
  super_admin: "default",
  admin: "default",
  board: "secondary",
  resident: "outline",
};

// -- Schemas ------------------------------------------------------------------

const profileSchema = z.object({
  full_name: z.string().min(1, "El nombre es requerido"),
});

const passwordSchema = z
  .object({
    password: z.string().min(6, "Minimo 6 caracteres"),
    confirm: z.string().min(6, "Minimo 6 caracteres"),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Las contrasenas no coinciden",
    path: ["confirm"],
  });

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

// -- Page ---------------------------------------------------------------------

export default function ProfilePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [authEmail, setAuthEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [profileFeedback, setProfileFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  // -- Fetch ------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (!authUser) return;

    setAuthEmail(authUser.email ?? "");

    const [userRes, tenantRes] = await Promise.all([
      supabase.from("users").select("*").eq("auth_id", authUser.id).single(),
      supabase.from("tenants").select("*").single(),
    ]);

    if (userRes.data) {
      setUser(userRes.data);
      profileForm.reset({ full_name: userRes.data.full_name });
    }
    if (tenantRes.data) {
      setTenant(tenantRes.data);
    }

    setLoading(false);
  }, [profileForm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -- Save profile -----------------------------------------------------------

  async function onSaveProfile(data: ProfileFormData) {
    if (!user) return;
    setIsSavingProfile(true);
    setProfileFeedback(null);

    const supabase = createClient();
    const { error } = await supabase
      .from("users")
      .update({ full_name: data.full_name })
      .eq("id", user.id);

    setIsSavingProfile(false);

    if (error) {
      setProfileFeedback({ type: "error", message: error.message });
      return;
    }

    setProfileFeedback({ type: "success", message: "Perfil actualizado" });
    fetchData();
    setTimeout(() => setProfileFeedback(null), 3000);
  }

  // -- Change password --------------------------------------------------------

  async function onChangePassword(data: PasswordFormData) {
    setIsSavingPassword(true);
    setPasswordFeedback(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: data.password,
    });

    setIsSavingPassword(false);

    if (error) {
      setPasswordFeedback({ type: "error", message: error.message });
      return;
    }

    setPasswordFeedback({
      type: "success",
      message: "Contrasena actualizada",
    });
    passwordForm.reset({ password: "", confirm: "" });
    setTimeout(() => setPasswordFeedback(null), 3000);
  }

  usePageTransition(containerRef, { ready: !loading });

  // -- Loading ----------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-5">
          <div className="h-[72px] w-[72px] animate-pulse rounded-full bg-muted" />
          <div className="space-y-2">
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-muted/40 ring-1 ring-foreground/5" />
        <div className="h-48 animate-pulse rounded-xl bg-muted/40 ring-1 ring-foreground/5" />
      </div>
    );
  }

  // -- Derived ----------------------------------------------------------------

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
      })
    : "";

  // -- Render -----------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-8">
      {/* Profile header */}
      <div className="anim-header relative overflow-hidden rounded-xl bg-gradient-to-br from-muted/80 via-muted/40 to-background ring-1 ring-foreground/[0.06]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,oklch(0.85_0.03_260/.08),transparent_60%)]" />
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-foreground/[0.02]" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-foreground/[0.015]" />

        <div className="relative flex items-center gap-5 px-6 py-6">
          {/* Avatar */}
          <div className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-foreground text-xl font-semibold tracking-tight text-background ring-[3px] ring-background shadow-lg">
            {initials}
            <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-background ring-2 ring-muted">
              <Shield className="h-2.5 w-2.5 text-foreground/60" />
            </div>
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="truncate text-lg font-semibold tracking-tight">
                {user?.full_name}
              </h2>
              {user?.role && (
                <Badge variant={ROLE_VARIANTS[user.role]}>
                  {ROLE_LABELS[user.role]}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3 w-3" />
                {authEmail}
              </span>
              {tenant && (
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-3 w-3" />
                  {tenant.name}
                </span>
              )}
              {memberSince && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Miembro desde {memberSince}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Personal info form */}
      <form
        onSubmit={profileForm.handleSubmit(onSaveProfile)}
        className="anim-card space-y-0"
      >
        {profileFeedback && (
          <FeedbackBanner
            type={profileFeedback.type}
            message={profileFeedback.message}
          />
        )}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-sm">Informacion personal</CardTitle>
            <CardDescription>
              Nombre y datos basicos de tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Nombre completo</Label>
                <Input
                  id="full_name"
                  placeholder="Tu nombre"
                  {...profileForm.register("full_name")}
                  aria-invalid={!!profileForm.formState.errors.full_name}
                />
                {profileForm.formState.errors.full_name && (
                  <p className="text-xs text-destructive">
                    {profileForm.formState.errors.full_name.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Correo electronico</Label>
                <Input value={authEmail} disabled />
                <p className="text-[11px] text-muted-foreground">
                  El correo no se puede cambiar desde aqui
                </p>
              </div>
            </div>

            {/* Read-only details */}
            <Separator />
            <div className="grid gap-4 sm:grid-cols-3">
              <ReadOnlyField label="Rol" value={user?.role ? ROLE_LABELS[user.role] : "-"} />
              <ReadOnlyField label="Estado" value={user?.is_active ? "Activo" : "Inactivo"} />
              <ReadOnlyField label="Organizacion" value={tenant?.name ?? "-"} />
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={isSavingProfile || !profileForm.formState.isDirty}
            >
              {isSavingProfile ? (
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

      {/* Password form */}
      <form
        onSubmit={passwordForm.handleSubmit(onChangePassword)}
        className="anim-card space-y-0"
      >
        {passwordFeedback && (
          <FeedbackBanner
            type={passwordFeedback.type}
            message={passwordFeedback.message}
          />
        )}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="font-display text-sm">Seguridad</CardTitle>
            </div>
            <CardDescription>
              Cambia tu contrasena de acceso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="password">Nueva contrasena</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimo 6 caracteres"
                  {...passwordForm.register("password")}
                  aria-invalid={!!passwordForm.formState.errors.password}
                />
                {passwordForm.formState.errors.password && (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.password.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar contrasena</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Repite la contrasena"
                  {...passwordForm.register("confirm")}
                  aria-invalid={!!passwordForm.formState.errors.confirm}
                />
                {passwordForm.formState.errors.confirm && (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.confirm.message}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={isSavingPassword || !passwordForm.formState.isDirty}
            >
              {isSavingPassword ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Actualizando...
                </span>
              ) : (
                <>
                  <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                  Cambiar contrasena
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

// -- Helpers ------------------------------------------------------------------

function FeedbackBanner({
  type,
  message,
}: {
  type: "success" | "error";
  message: string;
}) {
  return (
    <div
      className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${
        type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
          : "border-destructive/20 bg-destructive/5 text-destructive"
      }`}
    >
      {type === "success" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0" />
      )}
      {message}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
