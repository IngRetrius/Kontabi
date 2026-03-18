"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UnitType } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Building2,
  Home,
  Store,
  Car,
  Package,
  ArrowRight,
  MapPin,
} from "lucide-react";

// -- Constants --------------------------------------------------------------

const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  apartment: "Apartamentos",
  commercial: "Locales",
  parking: "Parqueaderos",
  storage: "Depositos",
};

const UNIT_TYPE_ICONS: Record<UnitType, typeof Home> = {
  apartment: Home,
  commercial: Store,
  parking: Car,
  storage: Package,
};

// -- Component --------------------------------------------------------------

export default function StructureSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    buildingCount: 0,
    unitCount: 0,
    unitsByType: {} as Record<string, number>,
    totalFloors: 0,
  });

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [buildingsRes, unitsRes] = await Promise.all([
      supabase.from("buildings").select("id, floors"),
      supabase.from("units").select("id, unit_type"),
    ]);

    const buildings = buildingsRes.data ?? [];
    const units = unitsRes.data ?? [];

    const unitsByType: Record<string, number> = {};
    units.forEach((u) => {
      unitsByType[u.unit_type] = (unitsByType[u.unit_type] || 0) + 1;
    });

    const totalFloors = buildings.reduce((sum, b) => sum + b.floors, 0);

    setStats({
      buildingCount: buildings.length,
      unitCount: units.length,
      unitsByType,
      totalFloors,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl bg-muted/40 ring-1 ring-foreground/5"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Resumen de estructura</CardTitle>
          <CardDescription>
            Vista general de la estructura fisica del conjunto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatBlock
              icon={<Building2 className="h-4 w-4" />}
              label="Torres"
              value={stats.buildingCount}
            />
            <StatBlock
              icon={<Home className="h-4 w-4" />}
              label="Unidades"
              value={stats.unitCount}
            />
            <StatBlock
              icon={<ArrowRight className="h-4 w-4" />}
              label="Pisos totales"
              value={stats.totalFloors}
            />
            <StatBlock
              icon={<MapPin className="h-4 w-4" />}
              label="Tipos"
              value={Object.keys(stats.unitsByType).length}
            />
          </div>
        </CardContent>
      </Card>

      {/* Units by type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Unidades por tipo</CardTitle>
          <CardDescription>
            Desglose de unidades segun su clasificacion
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.unitCount === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No hay unidades registradas todavia.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(UNIT_TYPE_LABELS) as UnitType[]).map((type) => {
                const count = stats.unitsByType[type] || 0;
                const Icon = UNIT_TYPE_ICONS[type];
                return (
                  <div
                    key={type}
                    className="flex items-center justify-between rounded-lg border px-4 py-3"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {UNIT_TYPE_LABELS[type]}
                      </span>
                    </div>
                    <Badge variant="secondary" className="tabular-nums">
                      {count}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Gestionar estructura</CardTitle>
          <CardDescription>
            Administra torres, unidades y zonas comunes desde la seccion
            correspondiente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/dashboard/units")}
            >
              <Building2 className="mr-1.5 h-3.5 w-3.5" />
              Ir a unidades
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Common areas placeholder */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">
            Zonas comunes
          </CardTitle>
          <CardDescription>
            La gestion de zonas comunes (salon social, piscina, gimnasio) se
            habilitara proximamente en esta seccion.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

// -- Sub-components ---------------------------------------------------------

function StatBlock({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="space-y-1 rounded-lg bg-muted/40 px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
