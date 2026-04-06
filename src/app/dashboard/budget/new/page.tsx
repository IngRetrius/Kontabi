"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePageTransition } from "@/hooks/use-page-transition";
import { useForm } from "react-hook-form";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import type { Account, BudgetItemCategory } from "@/types/database";
import { formatCOP } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Save,
  Plus,
  Trash2,
  ArrowLeft,
  AlertCircle,
  Loader2,
} from "lucide-react";

// -- Constants ---------------------------------------------------------------

const CATEGORY_LABELS: Record<BudgetItemCategory, string> = {
  payroll: "Nomina",
  security: "Vigilancia",
  cleaning: "Aseo",
  maintenance: "Mantenimiento",
  utilities: "Servicios publicos",
  insurance: "Seguros",
  admin: "Administrativos",
  legal: "Legales",
  reserve_fund: "Fondo de reserva",
  other: "Otros",
};

const DEFAULT_ITEMS: Array<{
  name: string;
  category: BudgetItemCategory;
  accountCode: string;
}> = [
  { name: "Nomina y prestaciones", category: "payroll", accountCode: "5110" },
  { name: "Vigilancia y seguridad", category: "security", accountCode: "5120" },
  { name: "Aseo y limpieza", category: "cleaning", accountCode: "5130" },
  { name: "Mantenimiento general", category: "maintenance", accountCode: "5140" },
  { name: "Servicios publicos", category: "utilities", accountCode: "5150" },
  { name: "Seguros", category: "insurance", accountCode: "5160" },
  { name: "Gastos administrativos", category: "admin", accountCode: "5170" },
  { name: "Gastos legales", category: "legal", accountCode: "5180" },
];

// -- Schema ------------------------------------------------------------------

const budgetSchema = z.object({
  year: z.coerce.number().min(2020).max(2099).pipe(z.number()),
  name: z.string().min(1, "El nombre es requerido"),
  reserveFundPct: z.coerce.number().min(0).max(100).pipe(z.number()),
  notes: z.string().optional(),
});

type BudgetFormData = z.infer<typeof budgetSchema>;

// -- Item type ---------------------------------------------------------------

interface ItemRow {
  tempId: string;
  name: string;
  category: BudgetItemCategory;
  accountCode: string;
  monthlyAmount: number;
}

// -- Page --------------------------------------------------------------------

export default function NewBudgetPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      year: new Date().getFullYear(),
      name: `Presupuesto ${new Date().getFullYear()}`,
      reserveFundPct: 1,
    },
  });

  const reserveFundPct = watch("reserveFundPct");

  // -- Fetch accounts --------------------------------------------------------

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("accounts")
        .select("*")
        .eq("is_active", true)
        .eq("account_type", "gasto")
        .eq("is_detail", true)
        .order("code");
      setAccounts((data ?? []) as Account[]);
    }
    load();
  }, []);

  // -- Seed default items once accounts are loaded ---------------------------

  useEffect(() => {
    if (accounts.length > 0 && items.length === 0) {
      setItems(
        DEFAULT_ITEMS.map((d, i) => ({
          tempId: `seed-${i}`,
          name: d.name,
          category: d.category,
          accountCode: d.accountCode,
          monthlyAmount: 0,
        }))
      );
    }
  }, [accounts, items.length]);

  // -- Item helpers ----------------------------------------------------------

  const addItem = () =>
    setItems((prev) => [
      ...prev,
      {
        tempId: `new-${Date.now()}`,
        name: "",
        category: "other",
        accountCode: "",
        monthlyAmount: 0,
      },
    ]);

  const removeItem = (id: string) =>
    setItems((prev) => prev.filter((i) => i.tempId !== id));

  const updateItem = (
    id: string,
    field: keyof ItemRow,
    value: string | number
  ) =>
    setItems((prev) =>
      prev.map((i) => (i.tempId === id ? { ...i, [field]: value } : i))
    );

  // -- Totals ----------------------------------------------------------------

  const totalMonthly = items.reduce((s, i) => s + i.monthlyAmount, 0);
  const totalAnnual = totalMonthly * 12;
  const reserveAmount = Math.round(totalAnnual * ((reserveFundPct ?? 1) / 100));

  usePageTransition(containerRef);

  // -- Save ------------------------------------------------------------------

  const onSubmit = async (data: BudgetFormData) => {
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("No hay sesion activa");
      setSaving(false);
      return;
    }

    const { data: uData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_id", user.id)
      .single();

    if (!uData) {
      setError("Tenant no encontrado");
      setSaving(false);
      return;
    }

    const tenantId = uData.tenant_id;

    // Budget header
    const { data: budget, error: bErr } = await supabase
      .from("budgets")
      .insert({
        tenant_id: tenantId,
        year: data.year,
        name: data.name,
        status: "draft",
        reserve_fund_pct: data.reserveFundPct,
        notes: data.notes || null,
      })
      .select()
      .single();

    if (bErr || !budget) {
      setError(bErr?.message ?? "Error creando presupuesto");
      setSaving(false);
      return;
    }

    // Budget items
    const accountMap = new Map(accounts.map((a) => [a.code, a.id]));
    const rows = items
      .filter((i) => i.name.trim() !== "")
      .map((item, idx) => ({
        tenant_id: tenantId,
        budget_id: budget.id,
        account_id: accountMap.get(item.accountCode) ?? null,
        name: item.name,
        category: item.category,
        monthly_amount: item.monthlyAmount,
        annual_amount: item.monthlyAmount * 12,
        sort_order: idx,
      }));

    if (rows.length > 0) {
      const { error: iErr } = await supabase
        .from("budget_items")
        .insert(rows);
      if (iErr) {
        setError(iErr.message);
        setSaving(false);
        return;
      }
    }

    router.push(`/dashboard/budget/${budget.id}`);
  };

  // -- Render ----------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="anim-header flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7 shrink-0"
          onClick={() => router.push("/dashboard/budget/list")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="space-y-0.5">
          <h2 className="font-display text-xl tracking-tight">
            Nuevo presupuesto
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Define los rubros y montos del presupuesto anual
          </p>
        </div>
      </div>

      {error && (
        <div className="anim-banner flex items-center gap-2.5 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ---- General ---- */}
        <Card className="anim-card">
          <CardHeader className="border-b px-4 py-3">
            <CardTitle className="font-display text-sm">
              Informacion general
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 p-4 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="year" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Ano
              </Label>
              <Input
                id="year"
                type="number"
                className="h-8 font-mono text-[13px]"
                {...register("year")}
              />
              {errors.year && (
                <p className="text-[11px] text-destructive">
                  {errors.year.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Nombre
              </Label>
              <Input
                id="name"
                className="h-8 text-[13px]"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-[11px] text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reserveFundPct" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                % Fondo reserva
              </Label>
              <Input
                id="reserveFundPct"
                type="number"
                step="0.01"
                className="h-8 font-mono text-[13px]"
                {...register("reserveFundPct")}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-4">
              <Label htmlFor="notes" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Notas
              </Label>
              <Textarea
                id="notes"
                rows={2}
                className="text-[13px]"
                placeholder="Notas internas o contexto para este presupuesto..."
                {...register("notes")}
              />
            </div>
          </CardContent>
        </Card>

        {/* ---- Items ---- */}
        <Card className="anim-card">
          <CardHeader className="border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-display text-sm">
                  Rubros del presupuesto
                </CardTitle>
                <CardDescription className="text-[11px]">
                  Monto mensual x 12 = anual. Vincula cada rubro a una cuenta
                  contable para el seguimiento de ejecucion.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[12px]"
                onClick={addItem}
              >
                <Plus className="mr-1.5 h-3 w-3" />
                Agregar rubro
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[220px] pl-4 text-[11px] font-medium uppercase tracking-wider">
                      Rubro
                    </TableHead>
                    <TableHead className="w-[140px] text-[11px] font-medium uppercase tracking-wider">
                      Categoria
                    </TableHead>
                    <TableHead className="w-[140px] text-[11px] font-medium uppercase tracking-wider">
                      Cuenta
                    </TableHead>
                    <TableHead className="w-[130px] text-right text-[11px] font-medium uppercase tracking-wider">
                      Mensual
                    </TableHead>
                    <TableHead className="w-[130px] text-right text-[11px] font-medium uppercase tracking-wider">
                      Anual
                    </TableHead>
                    <TableHead className="w-10 pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.tempId}>
                      <TableCell className="pl-4">
                        <Input
                          value={item.name}
                          onChange={(e) =>
                            updateItem(item.tempId, "name", e.target.value)
                          }
                          className="h-7 text-[13px]"
                          placeholder="Nombre del rubro"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.category}
                          onValueChange={(v) =>
                            updateItem(item.tempId, "category", v)
                          }
                        >
                          <SelectTrigger className="h-7 text-[11px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CATEGORY_LABELS).map(
                              ([key, label]) => (
                                <SelectItem
                                  key={key}
                                  value={key}
                                  className="text-[12px]"
                                >
                                  {label}
                                </SelectItem>
                              )
                            )}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.accountCode}
                          onValueChange={(v) =>
                            updateItem(item.tempId, "accountCode", v)
                          }
                        >
                          <SelectTrigger className="h-7 font-mono text-[11px]">
                            <SelectValue placeholder="--" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((acc) => (
                              <SelectItem
                                key={acc.id}
                                value={acc.code}
                                className="font-mono text-[11px]"
                              >
                                {acc.code} {acc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          value={item.monthlyAmount || ""}
                          onChange={(e) =>
                            updateItem(
                              item.tempId,
                              "monthlyAmount",
                              Number(e.target.value) || 0
                            )
                          }
                          className="h-7 text-right font-mono text-[13px]"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell className="text-right font-mono text-[13px] tabular-nums text-muted-foreground">
                        {formatCOP(item.monthlyAmount * 12)}
                      </TableCell>
                      <TableCell className="pr-4">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="h-6 w-6 text-muted-foreground/50 hover:text-destructive"
                          onClick={() => removeItem(item.tempId)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* ---- Totals strip ---- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
            <CardContent className="p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Total mensual
              </p>
              <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight">
                {formatCOP(totalMonthly)}
              </p>
            </CardContent>
          </Card>
          <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
            <CardContent className="p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Total anual
              </p>
              <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight">
                {formatCOP(totalAnnual)}
              </p>
            </CardContent>
          </Card>
          <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
            <CardContent className="p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                Fondo reserva ({reserveFundPct}%)
              </p>
              <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight">
                {formatCOP(reserveAmount)}
              </p>
            </CardContent>
          </Card>
          <Card className="anim-kpi border-primary/20 bg-primary/[0.03]">
            <CardContent className="p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-primary/70">
                Presupuesto total
              </p>
              <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums tracking-tight text-primary">
                {formatCOP(totalAnnual)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ---- Actions ---- */}
        <div className="flex justify-end gap-2 border-t border-border/50 pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => router.push("/dashboard/budget/list")}
          >
            Cancelar
          </Button>
          <Button type="submit" size="sm" className="h-8 text-xs" disabled={saving}>
            {saving ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3 w-3" />
            )}
            Guardar como borrador
          </Button>
        </div>
      </form>
    </div>
  );
}
