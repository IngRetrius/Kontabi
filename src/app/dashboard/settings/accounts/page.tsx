"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import type { Account, AccountType } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronRight,
  Plus,
  BookOpen,
  AlertCircle,
  Search,
  Layers,
} from "lucide-react";

// -- Constants ---------------------------------------------------------------

const TYPE_LABELS: Record<AccountType, string> = {
  activo: "Activo",
  pasivo: "Pasivo",
  patrimonio: "Patrimonio",
  ingreso: "Ingreso",
  gasto: "Gasto",
};

const TYPE_DOT_COLORS: Record<AccountType, string> = {
  activo: "bg-emerald-500/70",
  pasivo: "bg-rose-400/70",
  patrimonio: "bg-amber-400/70",
  ingreso: "bg-sky-400/70",
  gasto: "bg-orange-400/70",
};

// -- Schema ------------------------------------------------------------------

const subAccountSchema = z.object({
  code: z.string().min(1, "El codigo es requerido"),
  name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
});

type SubAccountFormData = z.infer<typeof subAccountSchema>;

// -- Tree node type ----------------------------------------------------------

interface AccountNode extends Account {
  children: AccountNode[];
}

function buildTree(accounts: Account[]): AccountNode[] {
  const map = new Map<string, AccountNode>();
  const roots: AccountNode[] = [];

  for (const acc of accounts) {
    map.set(acc.id, { ...acc, children: [] });
  }

  for (const acc of accounts) {
    const node = map.get(acc.id)!;
    if (acc.parent_id && map.has(acc.parent_id)) {
      map.get(acc.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// -- Component ---------------------------------------------------------------

export default function AccountsSettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [parentAccount, setParentAccount] = useState<Account | null>(null);

  // -- Fetch -----------------------------------------------------------------

  const fetchAccounts = useCallback(async () => {
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("accounts")
      .select("*")
      .order("code", { ascending: true });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const accs = (data as Account[]) ?? [];
    setAccounts(accs);

    // Auto-expand level 1 on first load
    if (expanded.size === 0) {
      const level1Ids = new Set(
        accs.filter((a) => a.level === 1).map((a) => a.id)
      );
      setExpanded(level1Ids);
    }

    setLoading(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // -- Tree ------------------------------------------------------------------

  const tree = useMemo(() => buildTree(accounts), [accounts]);

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return tree;

    const q = searchQuery.toLowerCase();
    const matching = new Set<string>();

    // Find all accounts matching the query and their ancestors
    for (const acc of accounts) {
      if (
        acc.code.toLowerCase().includes(q) ||
        acc.name.toLowerCase().includes(q)
      ) {
        matching.add(acc.id);
        // Walk up to root
        let parentId = acc.parent_id;
        while (parentId) {
          matching.add(parentId);
          const parent = accounts.find((a) => a.id === parentId);
          parentId = parent?.parent_id ?? null;
        }
      }
    }

    function filterNodes(nodes: AccountNode[]): AccountNode[] {
      return nodes
        .filter((n) => matching.has(n.id))
        .map((n) => ({ ...n, children: filterNodes(n.children) }));
    }

    return filterNodes(tree);
  }, [tree, searchQuery, accounts]);

  // -- Expand/collapse -------------------------------------------------------

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function expandAll() {
    setExpanded(
      new Set(accounts.filter((a) => !a.is_detail).map((a) => a.id))
    );
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  // -- Add sub-account -------------------------------------------------------

  function openAddDialog(parent: Account) {
    setParentAccount(parent);
    setAddDialogOpen(true);
  }

  // -- Stats -----------------------------------------------------------------

  const stats = useMemo(() => {
    const total = accounts.length;
    const detail = accounts.filter((a) => a.is_detail).length;
    const custom = accounts.filter((a) => !a.is_system).length;
    return { total, detail, custom };
  }, [accounts]);

  // -- Loading ---------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-5 w-56 animate-pulse rounded bg-muted" />
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-muted/40 ring-1 ring-foreground/5"
            />
          ))}
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-9 animate-pulse rounded-md bg-muted/30"
              style={{ marginLeft: `${(i % 3) * 24}px` }}
            />
          ))}
        </div>
      </div>
    );
  }

  // -- Empty -----------------------------------------------------------------

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                No hay plan de cuentas configurado
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                El plan de cuentas NIIF Grupo 3 se carga automaticamente al
                crear el conjunto. Contacta soporte si no se cargo.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // -- Render ----------------------------------------------------------------

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1 rounded-lg bg-muted/40 px-4 py-3">
          <p className="text-xs text-muted-foreground">Total cuentas</p>
          <p className="text-xl font-semibold tabular-nums">{stats.total}</p>
        </div>
        <div className="space-y-1 rounded-lg bg-muted/40 px-4 py-3">
          <p className="text-xs text-muted-foreground">Cuentas de detalle</p>
          <p className="text-xl font-semibold tabular-nums">{stats.detail}</p>
        </div>
        <div className="space-y-1 rounded-lg bg-muted/40 px-4 py-3">
          <p className="text-xs text-muted-foreground">Subcuentas propias</p>
          <p className="text-xl font-semibold tabular-nums">{stats.custom}</p>
        </div>
      </div>

      {/* Toolbar */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-sm">
                Plan de cuentas NIIF Grupo 3
              </CardTitle>
              <CardDescription>
                Decreto 2420 de 2015 - Contabilidad simplificada para propiedad
                horizontal
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={expandAll}>
                Expandir
              </Button>
              <Button variant="ghost" size="sm" onClick={collapseAll}>
                Colapsar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por codigo o nombre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground">
            {(Object.keys(TYPE_LABELS) as AccountType[]).map((type) => (
              <span key={type} className="flex items-center gap-1.5">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${TYPE_DOT_COLORS[type]}`}
                />
                {TYPE_LABELS[type]}
              </span>
            ))}
          </div>

          {/* Tree */}
          <div className="rounded-lg border">
            {filteredTree.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No se encontraron cuentas con &ldquo;{searchQuery}&rdquo;
              </p>
            ) : (
              <div className="divide-y">
                {filteredTree.map((node) => (
                  <AccountRow
                    key={node.id}
                    node={node}
                    depth={0}
                    expanded={expanded}
                    searchActive={!!searchQuery.trim()}
                    onToggle={toggleExpand}
                    onAddChild={openAddDialog}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add sub-account dialog */}
      <AddSubAccountDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        parentAccount={parentAccount}
        onCreated={fetchAccounts}
      />
    </div>
  );
}

// -- Account row (recursive) ------------------------------------------------

function AccountRow({
  node,
  depth,
  expanded,
  searchActive,
  onToggle,
  onAddChild,
}: {
  node: AccountNode;
  depth: number;
  expanded: Set<string>;
  searchActive: boolean;
  onToggle: (id: string) => void;
  onAddChild: (account: Account) => void;
}) {
  const isExpanded = expanded.has(node.id) || searchActive;
  const hasChildren = node.children.length > 0;
  const canAddChild = node.level === 3 && node.is_detail;
  const indent = depth * 20;

  return (
    <>
      <div
        className={`group flex items-center gap-2 px-3 py-1.5 transition-colors hover:bg-muted/30 ${
          !node.is_active ? "opacity-40" : ""
        } ${node.level === 1 ? "bg-muted/20" : ""}`}
        style={{ paddingLeft: `${12 + indent}px` }}
      >
        {/* Expand toggle */}
        <button
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors hover:bg-muted ${
            !hasChildren ? "invisible" : ""
          }`}
          onClick={() => onToggle(node.id)}
          aria-label={isExpanded ? "Colapsar" : "Expandir"}
        >
          <ChevronRight
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
              isExpanded ? "rotate-90" : ""
            }`}
          />
        </button>

        {/* Type dot */}
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${TYPE_DOT_COLORS[node.account_type]}`}
          title={TYPE_LABELS[node.account_type]}
        />

        {/* Code */}
        <span
          className={`shrink-0 font-mono text-xs tabular-nums ${
            node.level === 1
              ? "font-bold"
              : node.level === 2
                ? "font-semibold"
                : "text-muted-foreground"
          }`}
        >
          {node.code}
        </span>

        {/* Name */}
        <span
          className={`min-w-0 truncate text-sm ${
            node.level === 1
              ? "font-semibold uppercase tracking-wide"
              : node.level === 2
                ? "font-medium"
                : ""
          }`}
          title={node.description ?? node.name}
        >
          {node.name}
        </span>

        {/* Badges */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {node.is_detail && (
            <Badge variant="outline" className="text-[10px]">
              {node.nature === "debito" ? "DB" : "CR"}
            </Badge>
          )}
          {!node.is_system && (
            <Badge variant="secondary" className="text-[10px]">
              Propia
            </Badge>
          )}
          {canAddChild && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onAddChild(node);
              }}
              title="Agregar subcuenta"
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded &&
        hasChildren &&
        node.children.map((child) => (
          <AccountRow
            key={child.id}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            searchActive={searchActive}
            onToggle={onToggle}
            onAddChild={onAddChild}
          />
        ))}
    </>
  );
}

// -- Add sub-account dialog --------------------------------------------------

function AddSubAccountDialog({
  open,
  onOpenChange,
  parentAccount,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentAccount: Account | null;
  onCreated: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codePrefix = parentAccount ? parentAccount.code : "";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SubAccountFormData>({
    resolver: zodResolver(subAccountSchema),
  });

  useEffect(() => {
    if (open && parentAccount) {
      reset({
        code: codePrefix,
        name: "",
        description: "",
      });
      setError(null);
    }
  }, [open, parentAccount, codePrefix, reset]);

  async function onSubmit(data: SubAccountFormData) {
    if (!parentAccount) return;

    setIsSubmitting(true);
    setError(null);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("No hay sesion activa");
      setIsSubmitting(false);
      return;
    }

    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_id", user.id)
      .single();

    if (!userData) {
      setError("No se encontro el tenant");
      setIsSubmitting(false);
      return;
    }

    const { error: insertErr } = await supabase.from("accounts").insert({
      tenant_id: userData.tenant_id,
      code: data.code,
      name: data.name,
      account_type: parentAccount.account_type,
      nature: parentAccount.nature,
      parent_id: parentAccount.id,
      level: parentAccount.level + 1,
      is_detail: true,
      is_system: false,
      description: data.description || null,
    });

    setIsSubmitting(false);

    if (insertErr) {
      setError(
        insertErr.message.includes("unique")
          ? "Ya existe una cuenta con ese codigo"
          : insertErr.message
      );
      return;
    }

    onOpenChange(false);
    onCreated();
  }

  if (!parentAccount) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar subcuenta</DialogTitle>
          <DialogDescription>
            Nueva subcuenta bajo{" "}
            <span className="font-mono font-medium text-foreground">
              {parentAccount.code}
            </span>{" "}
            {parentAccount.name}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sub-code">Codigo</Label>
            <Input
              id="sub-code"
              placeholder={`${codePrefix}01`}
              className="font-mono"
              {...register("code")}
              aria-invalid={!!errors.code}
            />
            <p className="text-[11px] text-muted-foreground">
              Debe iniciar con {codePrefix}. Ejemplo: {codePrefix}01, {codePrefix}02
            </p>
            {errors.code && (
              <p className="text-xs text-destructive">{errors.code.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sub-name">Nombre</Label>
            <Input
              id="sub-name"
              placeholder="Nombre de la subcuenta"
              {...register("name")}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sub-desc">Descripcion</Label>
            <Textarea
              id="sub-desc"
              placeholder="Descripcion opcional de esta subcuenta"
              rows={2}
              className="resize-none"
              {...register("description")}
            />
          </div>

          <div className="flex items-center gap-3 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <Layers className="h-3.5 w-3.5 shrink-0" />
            <span>
              Tipo: {TYPE_LABELS[parentAccount.account_type]} / Naturaleza:{" "}
              {parentAccount.nature === "debito" ? "Debito" : "Credito"} / Nivel: {parentAccount.level + 1}
            </span>
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Guardando...
                </span>
              ) : (
                "Crear subcuenta"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
