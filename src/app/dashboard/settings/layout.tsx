"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Building2,
  LayoutGrid,
  Banknote,
  BookOpen,
  Bell,
  Landmark,
  Palette,
  type LucideIcon,
} from "lucide-react";

interface SettingsSection {
  label: string;
  path: string;
  icon: LucideIcon;
}

const SETTINGS_SECTIONS: SettingsSection[] = [
  { label: "General", path: "/dashboard/settings/general", icon: Building2 },
  { label: "Estructura", path: "/dashboard/settings/structure", icon: LayoutGrid },
  { label: "Financiero", path: "/dashboard/settings/financial", icon: Banknote },
  { label: "Contabilidad", path: "/dashboard/settings/accounts", icon: BookOpen },
  { label: "Notificaciones", path: "/dashboard/settings/notifications", icon: Bell },
  { label: "Bancos", path: "/dashboard/settings/banks", icon: Landmark },
  { label: "Marca", path: "/dashboard/settings/branding", icon: Palette },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Configuracion</h2>
        <p className="text-sm text-muted-foreground">
          Administra los parametros de tu conjunto residencial
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Mobile: horizontal scroll */}
        <nav className="flex gap-1 overflow-x-auto pb-1 lg:hidden">
          {SETTINGS_SECTIONS.map((section) => {
            const isActive = pathname === section.path;
            const Icon = section.icon;
            return (
              <Link
                key={section.path}
                href={section.path}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  isActive
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {section.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop: vertical sidebar */}
        <nav className="hidden w-[200px] shrink-0 lg:block">
          <ul className="space-y-0.5">
            {SETTINGS_SECTIONS.map((section) => {
              const isActive = pathname === section.path;
              const Icon = section.icon;
              return (
                <li key={section.path}>
                  <Link
                    href={section.path}
                    className={cn(
                      "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-foreground" />
                    )}
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground/70 group-hover:text-foreground"
                      )}
                    />
                    {section.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Content */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
