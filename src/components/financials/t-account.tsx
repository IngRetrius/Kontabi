"use client";

import { formatCOP } from "@/lib/utils/format";

// -- Types -------------------------------------------------------------------

export interface TAccountMovement {
  id: string;
  date: string;
  description: string;
  amount: number;
  entryNumber?: string;
  counterpartCode?: string;
  counterpartName?: string;
}

export interface TAccountData {
  code: string;
  name: string;
  accountType: string;
  nature: "debito" | "credito";
  debits: TAccountMovement[];
  credits: TAccountMovement[];
  debitTotal: number;
  creditTotal: number;
  balance: number;
}

export type TAccountViewLevel = "simple" | "detail" | "accounting";

// -- Labels by nature --------------------------------------------------------

const NATURE_LABELS = {
  debito: { left: "Entradas", right: "Salidas" },
  credito: { left: "Salidas", right: "Entradas" },
} as const;

const TYPE_COLORS: Record<string, string> = {
  activo: "border-emerald-500/30",
  pasivo: "border-rose-400/30",
  patrimonio: "border-amber-400/30",
  ingreso: "border-sky-400/30",
  gasto: "border-orange-400/30",
};

const TYPE_HEADER_COLORS: Record<string, string> = {
  activo: "bg-emerald-500/8 text-emerald-700 dark:text-emerald-300",
  pasivo: "bg-rose-400/8 text-rose-700 dark:text-rose-300",
  patrimonio: "bg-amber-400/8 text-amber-700 dark:text-amber-300",
  ingreso: "bg-sky-400/8 text-sky-700 dark:text-sky-300",
  gasto: "bg-orange-400/8 text-orange-700 dark:text-orange-300",
};

// -- Component ---------------------------------------------------------------

export function TAccount({
  data,
  level = "simple",
  onCounterpartClick,
}: {
  data: TAccountData;
  level?: TAccountViewLevel;
  onCounterpartClick?: (code: string) => void;
}) {
  const labels =
    level === "accounting"
      ? { left: "Debito", right: "Credito" }
      : NATURE_LABELS[data.nature];

  const borderColor = TYPE_COLORS[data.accountType] ?? "border-border";
  const headerColor =
    TYPE_HEADER_COLORS[data.accountType] ?? "bg-muted text-foreground";

  return (
    <div
      className={`overflow-hidden rounded-lg border-2 ${borderColor} bg-background`}
    >
      {/* Header bar */}
      <div
        className={`flex items-center justify-between px-3 py-2 ${headerColor}`}
      >
        <div className="min-w-0">
          {level === "accounting" && (
            <span className="mr-2 font-mono text-xs tabular-nums opacity-60">
              {data.code}
            </span>
          )}
          <span className="text-sm font-semibold">{data.name}</span>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-xs opacity-60">Saldo </span>
          <span className="font-mono text-sm font-bold tabular-nums">
            {formatCOP(data.balance)}
          </span>
        </div>
      </div>

      {/* T shape */}
      <div className="grid grid-cols-2 divide-x divide-border">
        {/* Left column (debits) */}
        <div className="min-h-[120px]">
          <div className="border-b bg-muted/30 px-3 py-1.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {labels.left}
          </div>
          <div className="divide-y divide-border/50">
            {data.debits.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground/50 italic">
                Sin movimientos
              </p>
            ) : (
              data.debits.map((mov) => (
                <MovementRow
                  key={mov.id}
                  movement={mov}
                  level={level}
                  onCounterpartClick={onCounterpartClick}
                />
              ))
            )}
          </div>
          {/* Column total */}
          <div className="border-t-2 border-border bg-muted/20 px-3 py-1.5 text-right">
            <span className="font-mono text-xs font-semibold tabular-nums">
              {formatCOP(data.debitTotal)}
            </span>
          </div>
        </div>

        {/* Right column (credits) */}
        <div className="min-h-[120px]">
          <div className="border-b bg-muted/30 px-3 py-1.5 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {labels.right}
          </div>
          <div className="divide-y divide-border/50">
            {data.credits.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground/50 italic">
                Sin movimientos
              </p>
            ) : (
              data.credits.map((mov) => (
                <MovementRow
                  key={mov.id}
                  movement={mov}
                  level={level}
                  onCounterpartClick={onCounterpartClick}
                />
              ))
            )}
          </div>
          {/* Column total */}
          <div className="border-t-2 border-border bg-muted/20 px-3 py-1.5 text-right">
            <span className="font-mono text-xs font-semibold tabular-nums">
              {formatCOP(data.creditTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// -- Movement row ------------------------------------------------------------

function MovementRow({
  movement,
  level,
  onCounterpartClick,
}: {
  movement: TAccountMovement;
  level: TAccountViewLevel;
  onCounterpartClick?: (code: string) => void;
}) {
  if (level === "simple") {
    return (
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {movement.description}
        </span>
        <span className="ml-2 shrink-0 font-mono text-xs tabular-nums">
          {formatCOP(movement.amount)}
        </span>
      </div>
    );
  }

  if (level === "detail") {
    return (
      <div className="space-y-0.5 px-3 py-1.5">
        <div className="flex items-center justify-between">
          <span className="min-w-0 truncate text-xs">
            {movement.description}
          </span>
          <span className="ml-2 shrink-0 font-mono text-xs tabular-nums">
            {formatCOP(movement.amount)}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>{movement.date}</span>
          {movement.counterpartName && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (movement.counterpartCode && onCounterpartClick) {
                  onCounterpartClick(movement.counterpartCode);
                }
              }}
              className={`truncate ${
                onCounterpartClick && movement.counterpartCode
                  ? "cursor-pointer underline decoration-dotted hover:text-foreground"
                  : ""
              }`}
            >
              Contrapartida: {movement.counterpartName}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Accounting level
  return (
    <div className="space-y-0.5 px-3 py-1.5">
      <div className="flex items-center justify-between">
        <span className="min-w-0 truncate text-xs font-mono">
          {movement.description}
        </span>
        <span className="ml-2 shrink-0 font-mono text-xs tabular-nums">
          {formatCOP(movement.amount)}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono">
        <span>{movement.date}</span>
        {movement.entryNumber && <span>Asiento: {movement.entryNumber}</span>}
        {movement.counterpartCode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onCounterpartClick) {
                onCounterpartClick(movement.counterpartCode!);
              }
            }}
            className={`${
              onCounterpartClick
                ? "cursor-pointer underline decoration-dotted hover:text-foreground"
                : ""
            }`}
          >
            Cta: {movement.counterpartCode}
          </button>
        )}
      </div>
    </div>
  );
}
