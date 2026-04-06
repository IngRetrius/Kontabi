"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Inicio",
  overview: "Panel general",
  financials: "Financiero",
  transactions: "Transacciones",
  journal: "Libro diario",
  "t-accounts": "T-Accounts",
  balance: "Balance general",
  "income-statement": "Estado de resultados",
  "cash-flow": "Flujo de caja",
  budget: "Presupuesto",
  list: "Listado",
  simulator: "Simulador",
  new: "Nuevo",
  payments: "Pagos",
  invoices: "Cobros",
  register: "Registrar pago",
  overdue: "Vencidos",
  "late-interest": "Mora",
  compliance: "Cumplimiento",
  "reserve-fund": "Fondo reserva",
  extraordinary: "Cuotas extraordinarias",
  assemblies: "Actas",
  reconciliation: "Conciliacion",
  indicators: "Indicadores",
  units: "Unidades",
  activities: "Actividades",
  calendar: "Calendario",
  bookings: "Reservas",
  reports: "Reportes",
  center: "Centro de reportes",
  assembly: "Asamblea",
  settings: "Configuracion",
  general: "General",
  financial: "Financiero",
  structure: "Estructura",
  accounts: "Cuentas",
  notifications: "Notificaciones",
  banks: "Bancos",
  branding: "Marca",
  setup: "Configuracion inicial",
  profile: "Perfil",
  audit: "Auditoria",
  log: "Registro",
  "period-locks": "Periodos",
  import: "Importar",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) return null;

  const crumbs = segments.map((segment, index) => {
    const path = "/" + segments.slice(0, index + 1).join("/");
    const label = ROUTE_LABELS[segment] || segment;
    const isLast = index === segments.length - 1;

    return { path, label, isLast, segment };
  });

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
      {crumbs.map((crumb, index) => (
        <span key={crumb.path} className="flex items-center gap-1">
          {index > 0 && (
            <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
          )}
          {crumb.isLast ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.path}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

export function getPageTitle(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  return ROUTE_LABELS[lastSegment] || lastSegment || "Panel general";
}
