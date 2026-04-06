"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wider">
              OAuth Error
            </span>
          </div>
          <CardTitle className="font-display text-xl tracking-tight">
            No pudimos completar el acceso con Google
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Verifica que el proveedor Google este configurado en Supabase y que el
            callback URL coincida con tu dominio actual.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Link
              href="/register"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Ir a registro
            </Link>
            <Link href="/login" className={cn(buttonVariants())}>
              Volver a login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
