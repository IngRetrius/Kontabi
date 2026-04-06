"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UnitType, CommonArea } from "@/types/database";
import { formatCOP } from "@/lib/utils/format";
import { CommonAreasDialog } from "@/components/settings/common-areas-dialog";
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
  Landmark,
  Users,
  Clock,
  DollarSign,
} from "lucide-react";
import { usePageTransition } from "@/hooks/use-page-transition";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    buildingCount: 0,
    unitCount: 0,
    unitsByType: {} as Record<string, number>,
    totalFloors: 0,
  });
  const [commonAreas, setCommonAreas] = useState<CommonArea[]>([]);
  const [showAreasDialog, setShowAreasDialog] = useState(false);

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [buildingsRes, unitsRes, areasRes] = await Promise.all([
      supabase.from("buildings").select("id, floors"),
      supabase.from("units").select("id, unit_type"),
      supabase
        .from("common_areas")
        .select("*")
        .order("name", { ascending: true }),
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
    setCommonAreas((areasRes.data as CommonArea[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  usePageTransition(containerRef, { ready: !loading });

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

  const activeAreas = commonAreas.filter((a) => a.is_active);

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Overview stats */}
      <Card className="anim-card">
        <CardHeader>
          <CardTitle className="font-display text-sm">Resumen de estructura</CardTitle>
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
              icon={<Landmark className="h-4 w-4" />}
              label="Zonas comunes"
              value={activeAreas.length}
            />
          </div>
        </CardContent>
      </Card>

      {/* Units by type */}
      <Card className="anim-card">
        <CardHeader>
          <CardTitle className="font-display text-sm">Unidades por tipo</CardTitle>
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

      {/* Common areas */}
      <Card className="anim-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display text-sm">Zonas comunes</CardTitle>
              <CardDescription>
                Espacios compartidos del conjunto residencial
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAreasDialog(true)}
            >
              <Landmark className="mr-1.5 h-3.5 w-3.5" />
              Gestionar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {commonAreas.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Landmark className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  No hay zonas comunes registradas
                </p>
                <button
                  className="mt-1 text-xs text-primary underline underline-offset-2"
                  onClick={() => setShowAreasDialog(true)}
                >
                  Agregar la primera zona comun
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {commonAreas.map((area) => (
                <div
                  key={area.id}
                  className={`rounded-lg border px-4 py-3 transition-colors ${
                    !area.is_active ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Landmark className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-sm font-medium">{area.name}</span>
                      {!area.is_active && (
                        <Badge variant="secondary" className="text-xs">
                          Inactiva
                        </Badge>
                      )}
                      {area.is_bookable && area.is_active && (
                        <Badge variant="outline" className="text-xs">
                          Reservable
                        </Badge>
                      )}
                    </div>

                    {area.capacity != null && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                        <Users className="h-3 w-3" />
                        {area.capacity}
                      </span>
                    )}
                  </div>

                  {(area.schedule || area.booking_cost > 0) && (
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 pl-6 text-xs text-muted-foreground/80">
                      {area.schedule && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {area.schedule}
                        </span>
                      )}
                      {area.booking_cost > 0 && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {formatCOP(area.booking_cost)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Card className="anim-card">
        <CardHeader>
          <CardTitle className="font-display text-sm">Gestionar estructura</CardTitle>
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

      {/* Common areas dialog */}
      <CommonAreasDialog
        open={showAreasDialog}
        onOpenChange={setShowAreasDialog}
        commonAreas={commonAreas}
        onUpdate={fetchData}
      />
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
    <div className="anim-kpi space-y-1 rounded-lg bg-muted/40 px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
