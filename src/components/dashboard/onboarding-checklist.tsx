"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  X,
  Users,
  Building2,
  Calculator,
  Percent,
  BookOpen,
} from "lucide-react";

// -- Types -------------------------------------------------------------------

interface ChecklistItem {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: typeof Users;
  done: boolean;
}

// -- Component ---------------------------------------------------------------

export function OnboardingChecklist() {
  const cardRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const checkProgress = useCallback(async (): Promise<ChecklistItem[]> => {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_id", user.id)
      .single();
    if (!userData) return [];

    const tid = userData.tenant_id;

    // Run all checks in parallel
    const [unitsRes, ownersRes, budgetsRes, settingsRes, txRes] =
      await Promise.all([
        // 1. Units with valid coefficients (sum should be close to 100)
        supabase
          .from("units")
          .select("coefficient")
          .eq("tenant_id", tid)
          .eq("is_active", true),

        // 2. Owners registered for any unit of this tenant
        supabase
          .from("owners")
          .select("id, unit:units!inner(tenant_id)")
          .eq("unit.tenant_id", tid)
          .eq("is_current", true)
          .limit(1),

        // 3. Budget exists
        supabase
          .from("budgets")
          .select("id")
          .eq("tenant_id", tid)
          .limit(1),

        // 4. Financial settings configured (late_fee_rate)
        supabase
          .from("tenant_settings")
          .select("key")
          .eq("tenant_id", tid)
          .eq("key", "late_fee_rate")
          .limit(1),

        // 5. At least one transaction recorded
        supabase
          .from("transactions")
          .select("id")
          .eq("tenant_id", tid)
          .limit(1),
      ]);

    // Evaluate coefficients: check if sum is between 95 and 105
    const coefficients = (unitsRes.data ?? []).map((u) =>
      Number(u.coefficient)
    );
    const coeffSum = coefficients.reduce((s, c) => s + c, 0);
    const coefficientsValid = coefficients.length >= 2 && coeffSum >= 95 && coeffSum <= 105;

    const result: ChecklistItem[] = [
      {
        key: "units",
        label: "Completar unidades y coeficientes",
        description:
          coefficients.length < 2
            ? "Agrega todas las unidades del conjunto"
            : coeffSum < 0.01
              ? `${coefficients.length} unidades, coeficientes no configurados`
              : `${coefficients.length} unidades, coeficientes suman ${coeffSum.toFixed(1)}%`,
        href: "/dashboard/units",
        icon: Building2,
        done: coefficientsValid,
      },
      {
        key: "owners",
        label: "Registrar propietarios",
        description: "Asigna propietarios a cada unidad",
        href: "/dashboard/units",
        icon: Users,
        done: (ownersRes.data?.length ?? 0) > 0,
      },
      {
        key: "budget",
        label: "Crear presupuesto",
        description: "Define el presupuesto anual de ingresos y gastos",
        href: "/dashboard/budget/new",
        icon: Calculator,
        done: (budgetsRes.data?.length ?? 0) > 0,
      },
      {
        key: "financial",
        label: "Configurar facturacion y mora",
        description: "Define fechas de corte, vencimiento y tasa de mora",
        href: "/dashboard/settings/financial",
        icon: Percent,
        done: (settingsRes.data?.length ?? 0) > 0,
      },
      {
        key: "transactions",
        label: "Registrar saldos iniciales",
        description: "Registra el primer movimiento contable",
        href: "/dashboard/financials/transactions",
        icon: BookOpen,
        done: (txRes.data?.length ?? 0) > 0,
      },
    ];

    return result;
  }, []);

  useEffect(() => {
    let cancelled = false;

    void checkProgress().then((result) => {
      if (cancelled) return;
      setItems(result);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [checkProgress]);

  useGSAP(
    () => {
      if (loading || dismissed) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.fromTo(
          cardRef.current,
          { y: 16, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5 }
        ).fromTo(
          ".checklist-item",
          { x: -10, opacity: 0 },
          { x: 0, opacity: 1, stagger: 0.05, duration: 0.35 },
          0.15
        );
      });
    },
    { scope: cardRef, dependencies: [loading, dismissed] }
  );

  // Don't render if loading, dismissed, or all items are done
  if (loading || dismissed) return null;

  const doneCount = items.filter((i) => i.done).length;
  if (doneCount === items.length) return null;

  const progressPercent = Math.round((doneCount / items.length) * 100);

  return (
    <Card ref={cardRef} className="relative border-emerald-200/40 dark:border-emerald-800/30">
      <Button
        variant="ghost"
        size="sm"
        className="absolute right-2 top-2 h-6 w-6 p-0 text-muted-foreground/50 hover:text-muted-foreground"
        onClick={() => setDismissed(true)}
        title="Ocultar"
      >
        <X className="h-3 w-3" />
      </Button>

      <CardHeader className="pb-3">
        <CardTitle className="font-display text-sm">
          Configura tu conjunto
        </CardTitle>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
            {doneCount}/{items.length}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-0.5 pb-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`checklist-item group flex items-center gap-3 rounded-md px-2.5 py-2 transition-colors ${
                item.done
                  ? "opacity-60"
                  : "hover:bg-muted/50"
              }`}
            >
              {item.done ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
              )}
              <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
              <div className="min-w-0 flex-1">
                <p
                  className={`text-[13px] font-medium ${
                    item.done
                      ? "text-muted-foreground line-through"
                      : "text-foreground"
                  }`}
                >
                  {item.label}
                </p>
                <p className="truncate text-[11px] text-muted-foreground/70">
                  {item.description}
                </p>
              </div>
              {!item.done && (
                <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/30 transition-colors group-hover:text-foreground" />
              )}
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
