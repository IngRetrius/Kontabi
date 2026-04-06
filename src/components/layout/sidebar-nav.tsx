"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  ArrowLeftRight,
  BookOpen,
  Columns3,
  Scale,
  TrendingUp,
  Wallet,
  Calculator,
  FlaskConical,
  CreditCard,
  Receipt,
  HandCoins,
  AlertTriangle,
  Shield,
  CircleDollarSign,
  FileText,
  GitCompareArrows,
  Gauge,
  Building2,
  CalendarDays,
  FileBarChart,
  Settings,
  ShieldCheck,
  Percent,
  Lock,
  type LucideIcon,
} from "lucide-react";

interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "General",
    items: [
      { label: "Panel general", icon: LayoutDashboard, path: "/dashboard/overview" },
    ],
  },
  {
    title: "Financiero",
    items: [
      { label: "Transacciones", icon: ArrowLeftRight, path: "/dashboard/financials/transactions" },
      { label: "Libro diario", icon: BookOpen, path: "/dashboard/financials/journal" },
      { label: "T-Accounts", icon: Columns3, path: "/dashboard/financials/t-accounts" },
      { label: "Balance general", icon: Scale, path: "/dashboard/financials/balance" },
      { label: "Estado de resultados", icon: TrendingUp, path: "/dashboard/financials/income-statement" },
      { label: "Flujo de caja", icon: Wallet, path: "/dashboard/financials/cash-flow" },
    ],
  },
  {
    title: "Presupuesto",
    items: [
      { label: "Presupuestos", icon: Calculator, path: "/dashboard/budget/list" },
      { label: "Simulador", icon: FlaskConical, path: "/dashboard/budget/simulator" },
    ],
  },
  {
    title: "Pagos",
    items: [
      { label: "Dashboard cartera", icon: CreditCard, path: "/dashboard/payments/dashboard" },
      { label: "Cobros", icon: Receipt, path: "/dashboard/payments/invoices" },
      { label: "Registrar pago", icon: HandCoins, path: "/dashboard/payments/register" },
      { label: "Vencidos", icon: AlertTriangle, path: "/dashboard/payments/overdue" },
      { label: "Mora", icon: Percent, path: "/dashboard/payments/late-interest" },
    ],
  },
  {
    title: "Cumplimiento",
    items: [
      { label: "Fondo reserva", icon: Shield, path: "/dashboard/compliance/reserve-fund" },
      { label: "Cuotas extra", icon: CircleDollarSign, path: "/dashboard/compliance/extraordinary" },
      { label: "Actas", icon: FileText, path: "/dashboard/compliance/assemblies" },
    ],
  },
  {
    title: "Operaciones",
    items: [
      { label: "Conciliacion", icon: GitCompareArrows, path: "/dashboard/reconciliation/list" },
      { label: "Indicadores", icon: Gauge, path: "/dashboard/indicators" },
      { label: "Unidades", icon: Building2, path: "/dashboard/units" },
      { label: "Actividades", icon: CalendarDays, path: "/dashboard/activities/calendar" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Reportes", icon: FileBarChart, path: "/dashboard/reports/center" },
      { label: "Configuracion", icon: Settings, path: "/dashboard/settings/general" },
      { label: "Auditoria", icon: ShieldCheck, path: "/dashboard/audit/log" },
      { label: "Bloqueo periodos", icon: Lock, path: "/dashboard/audit/period-locks" },
    ],
  },
];

interface SidebarNavProps {
  collapsed: boolean;
}

export function SidebarNav({ collapsed }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav className="h-full space-y-5 overflow-y-auto overflow-x-hidden px-2 py-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title} className="shell-nav-section">
          {!collapsed && (
            <span className="mb-1.5 block px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
              {section.title}
            </span>
          )}
          {collapsed && (
            <div className="mx-auto mb-1.5 h-px w-4 bg-border/40" />
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const isActive =
                pathname === item.path ||
                (item.path !== "/dashboard/overview" &&
                  pathname.startsWith(item.path));
              const Icon = item.icon;

              const linkContent = (
                <Link
                  href={item.path}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                    collapsed && "justify-center px-0",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                  )}
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isActive
                        ? "text-sidebar-foreground"
                        : "text-muted-foreground/70 group-hover:text-sidebar-foreground"
                    )}
                  />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <li key={item.path}>
                    <Tooltip>
                      <TooltipTrigger render={<div />}>
                        {linkContent}
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  </li>
                );
              }

              return <li key={item.path}>{linkContent}</li>;
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export { NAV_SECTIONS };
export type { NavItem, NavSection };
