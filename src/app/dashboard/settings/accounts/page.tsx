"use client";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BookOpen, Lock } from "lucide-react";

export default function AccountsSettingsPage() {
  return (
    <div className="space-y-6">
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <BookOpen className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-sm">
                Configuracion contable
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Lock className="h-2.5 w-2.5" />
                  Proximamente
                </span>
              </CardTitle>
              <CardDescription>
                Esta seccion se habilitara con el modulo contable (P2). Incluira:
              </CardDescription>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                  Formato de numeracion de asientos contables
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                  Configuracion de partida doble
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                  Plan de cuentas personalizado
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/40" />
                  Periodos contables y cierres
                </li>
              </ul>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
