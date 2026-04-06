"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePageTransition } from "@/hooks/use-page-transition";
import { formatCOP } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Scale,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Printer,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// -- Types -------------------------------------------------------------------

type AccountType = "activo" | "pasivo" | "patrimonio";

interface BalanceRow {
  accountId: string;
  code: string;
  name: string;
  accountType: AccountType;
  nature: string;
  level: number;
  parentId: string | null;
  isDetail: boolean;
  balance: number;
}

interface AccountNode {
  id: string;
  code: string;
  name: string;
  accountType: AccountType;
  level: number;
  isDetail: boolean;
  balance: number;
  children: AccountNode[];
}

type BalanceMode = "cumulative" | "period";

// -- Constants ---------------------------------------------------------------

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const SECTION_CONFIG: Record<AccountType, {
  label: string;
  totalLabel: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}> = {
  activo: {
    label: "ACTIVOS",
    totalLabel: "TOTAL ACTIVOS",
    colorClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-500/5",
    borderClass: "border-emerald-500/20",
  },
  pasivo: {
    label: "PASIVOS",
    totalLabel: "TOTAL PASIVOS",
    colorClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-500/5",
    borderClass: "border-amber-500/20",
  },
  patrimonio: {
    label: "PATRIMONIO",
    totalLabel: "TOTAL PATRIMONIO",
    colorClass: "text-violet-600 dark:text-violet-400",
    bgClass: "bg-violet-500/5",
    borderClass: "border-violet-500/20",
  },
};

// -- Helpers -----------------------------------------------------------------

function buildPeriodOptions(): { value: string; label: string }[] {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    options.push({ value, label });
  }
  return options;
}

function buildTree(rows: BalanceRow[]): Record<AccountType, AccountNode[]> {
  const nodeMap = new Map<string, AccountNode>();

  // Sort by code to ensure parents come before children
  const sorted = [...rows].sort((a, b) => a.code.localeCompare(b.code));

  for (const row of sorted) {
    nodeMap.set(row.accountId, {
      id: row.accountId,
      code: row.code,
      name: row.name,
      accountType: row.accountType,
      level: row.level,
      isDetail: row.isDetail,
      balance: row.balance,
      children: [],
    });
  }

  const roots: Record<AccountType, AccountNode[]> = {
    activo: [],
    pasivo: [],
    patrimonio: [],
  };

  for (const row of sorted) {
    const node = nodeMap.get(row.accountId)!;
    if (row.parentId && nodeMap.has(row.parentId)) {
      nodeMap.get(row.parentId)!.children.push(node);
    } else if (row.accountType in roots) {
      roots[row.accountType].push(node);
    }
  }

  return roots;
}

function sumSection(nodes: AccountNode[]): number {
  return nodes.reduce((acc, node) => {
    if (node.level === 1) {
      // Level 1 nodes: sum their children (groups)
      return acc + sumChildren(node);
    }
    return acc + node.balance;
  }, 0);
}

function sumChildren(node: AccountNode): number {
  if (node.children.length === 0) return node.balance;
  return node.children.reduce((acc, child) => acc + sumChildren(child), 0);
}

// -- Page Component ----------------------------------------------------------

export default function BalanceGeneralPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [period, setPeriod] = useState(currentPeriod);
  const [mode, setMode] = useState<BalanceMode>("cumulative");
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const periodOptions = useMemo(buildPeriodOptions, []);

  // -- Fetch -----------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    // 1. Fetch account hierarchy (RLS filters by tenant)
    const { data: accounts, error: accErr } = await supabase
      .from("accounts")
      .select("id, code, name, account_type, nature, parent_id, level, is_detail")
      .in("account_type", ["activo", "pasivo", "patrimonio"])
      .eq("is_active", true)
      .order("code");

    if (accErr) {
      setError(accErr.message);
      setLoading(false);
      return;
    }

    // 2. Fetch confirmed journal entry lines with date filtering
    //    journal_entries has RLS, so only current tenant data is returned
    let jeQuery = supabase
      .from("journal_entries")
      .select("id, date")
      .eq("status", "confirmed");

    if (mode === "cumulative") {
      // All entries up to end of selected period
      const [year, month] = period.split("-").map(Number);
      const endDate = new Date(year, month, 0); // last day of month
      const endStr = `${year}-${String(month).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
      jeQuery = jeQuery.lte("date", endStr);
    } else {
      // Only entries within the selected period
      const [year, month] = period.split("-").map(Number);
      const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = new Date(year, month, 0);
      const endStr = `${year}-${String(month).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
      jeQuery = jeQuery.gte("date", startStr).lte("date", endStr);
    }

    const { data: entries, error: jeErr } = await jeQuery;

    if (jeErr) {
      setError(jeErr.message);
      setLoading(false);
      return;
    }

    // 3. Fetch lines for those entries
    const entryIds = (entries ?? []).map((e) => e.id);
    const balanceMap = new Map<string, { debit: number; credit: number }>();

    if (entryIds.length > 0) {
      // Fetch in batches to avoid URL length limits
      const BATCH_SIZE = 200;
      for (let i = 0; i < entryIds.length; i += BATCH_SIZE) {
        const batch = entryIds.slice(i, i + BATCH_SIZE);
        const { data: lines, error: linesErr } = await supabase
          .from("journal_entry_lines")
          .select("account_id, debit, credit")
          .in("journal_entry_id", batch);

        if (linesErr) {
          setError(linesErr.message);
          setLoading(false);
          return;
        }

        for (const line of lines ?? []) {
          const current = balanceMap.get(line.account_id) ?? { debit: 0, credit: 0 };
          current.debit += Number(line.debit);
          current.credit += Number(line.credit);
          balanceMap.set(line.account_id, current);
        }
      }
    }

    // 4. Calculate balance per account respecting nature
    const accountNatureMap = new Map<string, string>();
    for (const a of (accounts ?? []) as Array<{ id: string; nature: string }>) {
      accountNatureMap.set(a.id, a.nature);
    }

    const finalBalanceMap = new Map<string, number>();
    for (const [accountId, totals] of balanceMap) {
      const nature = accountNatureMap.get(accountId);
      const balance = nature === "debito"
        ? totals.debit - totals.credit
        : totals.credit - totals.debit;
      finalBalanceMap.set(accountId, balance);
    }

    // 5. Build rows
    const result: BalanceRow[] = ((accounts ?? []) as Array<{
      id: string;
      code: string;
      name: string;
      account_type: string;
      nature: string;
      parent_id: string | null;
      level: number;
      is_detail: boolean;
    }>).map((a) => ({
      accountId: a.id,
      code: a.code,
      name: a.name,
      accountType: a.account_type as AccountType,
      nature: a.nature,
      level: a.level,
      parentId: a.parent_id,
      isDetail: a.is_detail,
      balance: finalBalanceMap.get(a.id) ?? 0,
    }));

    setRows(result);
    setLoading(false);
  }, [period, mode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -- Refresh balances ------------------------------------------------------

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // -- Expand/collapse -------------------------------------------------------

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allGroupIds = rows
      .filter((r) => !r.isDetail && r.level >= 2)
      .map((r) => r.accountId);
    setExpandedGroups(new Set(allGroupIds));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  // -- Compute tree and totals -----------------------------------------------

  const tree = useMemo(() => buildTree(rows), [rows]);

  const totalActivos = useMemo(() => sumSection(tree.activo), [tree]);
  const totalPasivos = useMemo(() => sumSection(tree.pasivo), [tree]);
  const totalPatrimonio = useMemo(() => sumSection(tree.patrimonio), [tree]);
  const isBalanced = Math.abs(totalActivos - (totalPasivos + totalPatrimonio)) < 0.01;

  // -- Print -----------------------------------------------------------------

  const handlePrint = () => window.print();

  usePageTransition(containerRef, { ready: !(loading && rows.length === 0) });

  // -- Loading ---------------------------------------------------------------

  if (loading && rows.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-56 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/20" />
          ))}
        </div>
        <div className="space-y-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-muted/15" />
          ))}
        </div>
      </div>
    );
  }

  // -- Render ----------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-5 print:space-y-3">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-sm text-destructive print:hidden">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Header + Controls */}
      <div className="anim-header flex items-end justify-between gap-4 print:hidden">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-xl tracking-tight">
              Balance general
            </h2>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Estado de situacion financiera -- NIIF Grupo 3
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={handlePrint}
          >
            <Printer className="mr-1.5 h-3 w-3" />
            Imprimir
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-1.5 h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            Actualizar saldos
          </Button>
        </div>
      </div>

      {/* Print header (hidden on screen) */}
      <div className="hidden print:block print:text-center print:pb-2 print:border-b">
        <h1 className="text-lg font-bold">Balance General</h1>
        <p className="text-sm text-muted-foreground">
          {mode === "cumulative" ? "Acumulado hasta" : "Periodo"}{" "}
          {periodOptions.find((p) => p.value === period)?.label ?? period}
        </p>
      </div>

      {/* Filters */}
      <Card className="anim-filter print:hidden">
        <CardContent className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Periodo
            </Label>
            <Select value={period} onValueChange={(v) => { if (v) setPeriod(v); }}>
              <SelectTrigger className="h-8 w-48 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-[13px]">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Modo
            </Label>
            <div className="flex items-center gap-0.5 rounded-lg bg-muted p-[3px]">
              <button
                onClick={() => setMode("cumulative")}
                className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  mode === "cumulative"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Acumulado
              </button>
              <button
                onClick={() => setMode("period")}
                className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  mode === "period"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Solo periodo
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={expandAll}>
              Expandir todo
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={collapseAll}>
              Colapsar todo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
        <KpiCard
          label="Total activos"
          value={totalActivos}
          colorClass="text-emerald-600 dark:text-emerald-400"
          borderClass="border-emerald-500/20"
        />
        <KpiCard
          label="Total pasivos"
          value={totalPasivos}
          colorClass="text-amber-600 dark:text-amber-400"
          borderClass="border-amber-500/20"
        />
        <KpiCard
          label="Total patrimonio"
          value={totalPatrimonio}
          colorClass="text-violet-600 dark:text-violet-400"
          borderClass="border-violet-500/20"
        />
        <Card className={`relative overflow-hidden ${isBalanced ? "border-emerald-500/20" : "border-destructive/30"}`}>
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Ecuacion contable
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              {isBalanced ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className={`font-mono text-sm font-semibold tabular-nums ${isBalanced ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {isBalanced ? "Cuadrado" : `Diferencia: ${formatCOP(Math.abs(totalActivos - (totalPasivos + totalPatrimonio)))}`}
              </span>
            </div>
            <p className="mt-1 font-mono text-[10px] tabular-nums text-muted-foreground/60">
              A = P + Pt
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Balance Sheet Sections */}
      <div className="anim-card space-y-3 print:space-y-2">
        {(["activo", "pasivo", "patrimonio"] as AccountType[]).map((type) => (
          <BalanceSection
            key={type}
            type={type}
            nodes={tree[type]}
            expandedGroups={expandedGroups}
            onToggleGroup={toggleGroup}
          />
        ))}
      </div>

      {/* Equation verification */}
      <Card className="anim-fade border-dashed print:border-solid">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Verificacion de la ecuacion contable
              </p>
              <p className="font-mono text-[12px] tabular-nums text-muted-foreground">
                Activos = Pasivos + Patrimonio
              </p>
            </div>
            <div className="text-right space-y-0.5">
              <p className="font-mono text-[13px] tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400">{formatCOP(totalActivos)}</span>
                {" = "}
                <span className="text-amber-600 dark:text-amber-400">{formatCOP(totalPasivos)}</span>
                {" + "}
                <span className="text-violet-600 dark:text-violet-400">{formatCOP(totalPatrimonio)}</span>
              </p>
              <p className="font-mono text-[13px] tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400">{formatCOP(totalActivos)}</span>
                {" = "}
                <span className="font-semibold">{formatCOP(totalPasivos + totalPatrimonio)}</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// -- KPI Card ----------------------------------------------------------------

function KpiCard({
  label,
  value,
  colorClass,
  borderClass,
}: {
  label: string;
  value: number;
  colorClass: string;
  borderClass: string;
}) {
  return (
    <Card className={`relative overflow-hidden ${borderClass}`}>
      <CardContent className="p-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {label}
        </p>
        <p className={`mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight ${colorClass}`}>
          {formatCOP(value)}
        </p>
        <div className="absolute -right-2 -top-2 h-14 w-14 rounded-full bg-foreground/[0.03]" />
      </CardContent>
    </Card>
  );
}

// -- Balance Section ---------------------------------------------------------

function BalanceSection({
  type,
  nodes,
  expandedGroups,
  onToggleGroup,
}: {
  type: AccountType;
  nodes: AccountNode[];
  expandedGroups: Set<string>;
  onToggleGroup: (id: string) => void;
}) {
  const config = SECTION_CONFIG[type];
  const sectionTotal = sumSection(nodes);

  return (
    <Card>
      <CardHeader className={`border-b px-4 py-2.5 ${config.bgClass}`}>
        <div className="flex items-center justify-between">
          <CardTitle className={`font-mono text-[13px] font-bold tracking-wider ${config.colorClass}`}>
            {config.label}
          </CardTitle>
          <span className={`font-mono text-[13px] font-bold tabular-nums ${config.colorClass}`}>
            {formatCOP(sectionTotal)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {nodes.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-muted-foreground">
            Sin cuentas con movimientos para este periodo
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {nodes.map((classNode) => (
              <ClassSection
                key={classNode.id}
                node={classNode}
                expandedGroups={expandedGroups}
                onToggleGroup={onToggleGroup}
                colorClass={config.colorClass}
              />
            ))}
          </div>
        )}

        {/* Section total */}
        <div className={`flex items-center justify-between border-t-2 ${config.borderClass} px-4 py-2.5 ${config.bgClass}`}>
          <span className={`font-mono text-[13px] font-bold tracking-wide ${config.colorClass}`}>
            {config.totalLabel}
          </span>
          <span className={`font-mono text-[15px] font-bold tabular-nums ${config.colorClass}`}>
            {formatCOP(sectionTotal)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// -- Class Section (Level 1) -------------------------------------------------

function ClassSection({
  node,
  expandedGroups,
  onToggleGroup,
  colorClass,
}: {
  node: AccountNode;
  expandedGroups: Set<string>;
  onToggleGroup: (id: string) => void;
  colorClass: string;
}) {
  const classTotal = sumChildren(node);

  return (
    <div>
      {/* Level 1: class header (e.g. 1000 ACTIVOS) -- only shown if there are sub-groups */}
      {node.children.length > 0 && (
        <div className="space-y-0">
          {node.children.map((group) => (
            <GroupSection
              key={group.id}
              node={group}
              expanded={expandedGroups.has(group.id)}
              onToggle={() => onToggleGroup(group.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// -- Group Section (Level 2) -------------------------------------------------

function GroupSection({
  node,
  expanded,
  onToggle,
}: {
  node: AccountNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  const groupTotal = sumChildren(node);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      {/* Group header */}
      <button
        onClick={hasChildren ? onToggle : undefined}
        className={`flex w-full items-center justify-between px-4 py-2 text-left transition-colors ${
          hasChildren ? "cursor-pointer hover:bg-muted/40" : "cursor-default"
        }`}
      >
        <div className="flex items-center gap-2">
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )
          ) : (
            <span className="w-3" />
          )}
          <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
            {node.code}
          </span>
          <span className="text-[13px] font-semibold">
            {node.name}
          </span>
        </div>
        <span className="font-mono text-[13px] font-semibold tabular-nums">
          {formatCOP(groupTotal)}
        </span>
      </button>

      {/* Detail accounts */}
      {expanded && hasChildren && (
        <div className="border-t border-dashed border-border/40 bg-muted/20">
          {node.children.map((detail) => (
            <DetailRow key={detail.id} node={detail} />
          ))}
        </div>
      )}
    </div>
  );
}

// -- Detail Row (Level 3+) ---------------------------------------------------

function DetailRow({ node }: { node: AccountNode }) {
  if (node.balance === 0 && node.children.length === 0) return null;

  const displayBalance = node.children.length > 0 ? sumChildren(node) : node.balance;

  return (
    <div className="flex items-center justify-between px-4 py-1.5 pl-12">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
          {node.code}
        </span>
        <span className="text-[12px] text-muted-foreground">
          {node.name}
        </span>
      </div>
      <span className={`font-mono text-[12px] tabular-nums ${displayBalance === 0 ? "text-muted-foreground/40" : ""}`}>
        {formatCOP(displayBalance)}
      </span>
    </div>
  );
}
