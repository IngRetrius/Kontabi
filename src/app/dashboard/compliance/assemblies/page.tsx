"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePageTransition } from "@/hooks/use-page-transition";
import { createClient } from "@/lib/supabase/client";
import type { AssemblyAct, AssemblyActDecision } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FileText,
  Plus,
  RefreshCw,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Trash2,
  ExternalLink,
} from "lucide-react";

// -- Page --------------------------------------------------------------------

export default function AssembliesPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [acts, setActs] = useState<AssemblyAct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newType, setNewType] = useState<"ordinary" | "extraordinary">(
    "ordinary"
  );
  const [newActNumber, setNewActNumber] = useState("");
  const [newDate, setNewDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [newQuorum, setNewQuorum] = useState("51");
  const [newDescription, setNewDescription] = useState("");
  const [newAttendees, setNewAttendees] = useState("");
  const [newCoefficient, setNewCoefficient] = useState("");
  const [newDecisions, setNewDecisions] = useState<AssemblyActDecision[]>([]);

  // -- Fetch -----------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data, error: err } = await supabase
      .from("assembly_acts")
      .select("*")
      .order("date", { ascending: false });

    if (err) setError(err.message);
    else setActs((data ?? []) as AssemblyAct[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -- Decision helpers ------------------------------------------------------

  const addDecision = () =>
    setNewDecisions((prev) => [
      ...prev,
      { decision: "", votes_for: 0, votes_against: 0, approved: true },
    ]);

  const updateDecision = (
    idx: number,
    field: keyof AssemblyActDecision,
    value: string | number | boolean
  ) =>
    setNewDecisions((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d))
    );

  const removeDecision = (idx: number) =>
    setNewDecisions((prev) => prev.filter((_, i) => i !== idx));

  // -- Create ----------------------------------------------------------------

  const handleCreate = async () => {
    setCreateError(null);

    if (!newActNumber.trim()) {
      setCreateError("El numero de acta es obligatorio");
      return;
    }
    if (!newDescription.trim()) {
      setCreateError("La descripcion es obligatoria");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setCreateError("No hay sesion activa");
      setSaving(false);
      return;
    }

    const { data: uData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_id", user.id)
      .single();
    if (!uData) {
      setCreateError("Tenant no encontrado");
      setSaving(false);
      return;
    }

    const { error: insertErr } = await supabase
      .from("assembly_acts")
      .insert({
        tenant_id: uData.tenant_id,
        type: newType,
        act_number: newActNumber.trim(),
        date: newDate,
        quorum: Number(newQuorum) || 0,
        description: newDescription.trim(),
        decisions: newDecisions.filter((d) => d.decision.trim() !== ""),
        attendees_count: Number(newAttendees) || null,
        total_coefficient: Number(newCoefficient) || null,
      });

    if (insertErr) {
      setCreateError(insertErr.message);
      setSaving(false);
      return;
    }

    setCreateOpen(false);
    setCreateError(null);
    setNewActNumber("");
    setNewDescription("");
    setNewDecisions([]);
    setNewAttendees("");
    setNewCoefficient("");
    setSaving(false);
    await fetchData();
  };

  // -- KPIs ------------------------------------------------------------------

  const totalOrdinary = acts.filter((a) => a.type === "ordinary").length;
  const totalExtraordinary = acts.filter(
    (a) => a.type === "extraordinary"
  ).length;

  usePageTransition(containerRef, { ready: !loading });

  // -- Render ----------------------------------------------------------------

  return (
    <div ref={containerRef} className="space-y-6">
      {/* Header */}
      <div className="anim-header flex items-end justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-display text-xl tracking-tight">
              Actas de asamblea
            </h2>
          </div>
          <p className="text-[13px] text-muted-foreground">
            Registro de asambleas de copropietarios. Soporte legal para
            decisiones financieras.
          </p>
        </div>
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            setNewDecisions([]);
            setCreateError(null);
            setCreateOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-3 w-3" />
          Registrar acta
        </Button>
      </div>

      {error && (
        <div className="anim-banner flex items-center gap-2.5 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="anim-kpi group relative transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Total actas
            </p>
            <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {acts.length}
            </p>
            <div className="absolute -right-2 -top-2 h-14 w-14 rounded-full bg-foreground/[0.03]" />
          </CardContent>
        </Card>
        <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Ordinarias
            </p>
            <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {totalOrdinary}
            </p>
          </CardContent>
        </Card>
        <Card className="anim-kpi group transition-all duration-300 hover:shadow-md hover:ring-foreground/20">
          <CardContent className="p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              Extraordinarias
            </p>
            <p className="mt-0.5 font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {totalExtraordinary}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Acts list */}
      <Card className="anim-table">
        <CardHeader className="border-b px-4 py-3">
          <CardTitle className="font-display text-sm">
            Historial de asambleas
          </CardTitle>
          <CardDescription className="text-[11px]">
            Haz clic en un acta para ver sus decisiones.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Cargando...
            </div>
          ) : acts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-border">
                <FileText className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <p className="text-[13px] text-muted-foreground">
                Sin actas registradas
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-20 pl-4 text-[11px] font-medium uppercase tracking-wider">
                      Numero
                    </TableHead>
                    <TableHead className="w-24 text-[11px] font-medium uppercase tracking-wider">
                      Fecha
                    </TableHead>
                    <TableHead className="w-28 text-[11px] font-medium uppercase tracking-wider">
                      Tipo
                    </TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider">
                      Descripcion
                    </TableHead>
                    <TableHead className="w-20 text-center text-[11px] font-medium uppercase tracking-wider">
                      Quorum
                    </TableHead>
                    <TableHead className="w-20 text-center text-[11px] font-medium uppercase tracking-wider">
                      Decisiones
                    </TableHead>
                    <TableHead className="w-10 pr-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {acts.map((act) => {
                    const isExpanded = expandedId === act.id;
                    const decisions = act.decisions as AssemblyActDecision[];

                    return (
                      <>
                        <TableRow
                          key={act.id}
                          className="cursor-pointer"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : act.id)
                          }
                        >
                          <TableCell className="pl-4 font-mono text-[13px] font-semibold">
                            #{act.act_number}
                          </TableCell>
                          <TableCell className="font-mono text-[12px] tabular-nums text-muted-foreground">
                            {act.date}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                act.type === "ordinary"
                                  ? "secondary"
                                  : "outline"
                              }
                              className="text-[11px]"
                            >
                              {act.type === "ordinary"
                                ? "Ordinaria"
                                : "Extraordinaria"}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate text-[13px]">
                            {act.description}
                          </TableCell>
                          <TableCell className="text-center font-mono text-[13px] tabular-nums">
                            {act.quorum}%
                          </TableCell>
                          <TableCell className="text-center font-mono text-[13px] tabular-nums">
                            {decisions.length}
                          </TableCell>
                          <TableCell className="pr-4">
                            {isExpanded ? (
                              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </TableCell>
                        </TableRow>
                        {isExpanded && decisions.length > 0 && (
                          <TableRow key={`${act.id}-decisions`}>
                            <TableCell colSpan={7} className="bg-muted/30 p-0">
                              <div className="px-6 py-3">
                                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                                  Decisiones
                                </p>
                                <div className="space-y-1.5">
                                  {decisions.map((d, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-start gap-2 rounded-md border border-border/50 bg-background px-3 py-2"
                                    >
                                      {d.approved ? (
                                        <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                                      ) : (
                                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                                      )}
                                      <div className="flex-1">
                                        <p className="text-[13px]">
                                          {d.decision}
                                        </p>
                                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                          A favor: {d.votes_for} &middot;
                                          En contra: {d.votes_against}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                {act.document_url && (
                                  <a
                                    href={act.document_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Ver documento PDF
                                  </a>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[15px]">
              Registrar acta de asamblea
            </DialogTitle>
            <DialogDescription className="text-[13px]">
              Registra la informacion de la asamblea y sus decisiones.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {createError && (
              <div className="flex items-center gap-2.5 rounded-md border border-destructive/20 bg-destructive/5 px-4 py-2.5 text-[13px] text-destructive">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {createError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Tipo
                </Label>
                <Select
                  value={newType}
                  onValueChange={(v) =>
                    setNewType(v as "ordinary" | "extraordinary")
                  }
                >
                  <SelectTrigger className="h-8 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ordinary" className="text-[12px]">
                      Ordinaria
                    </SelectItem>
                    <SelectItem value="extraordinary" className="text-[12px]">
                      Extraordinaria
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Numero de acta
                </Label>
                <Input
                  value={newActNumber}
                  onChange={(e) => setNewActNumber(e.target.value)}
                  className="h-8 font-mono text-[13px]"
                  placeholder="001-2026"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Fecha
                </Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="h-8 font-mono text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Quorum (%)
                </Label>
                <Input
                  type="number"
                  value={newQuorum}
                  onChange={(e) => setNewQuorum(e.target.value)}
                  className="h-8 font-mono text-[13px]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Asistentes
                </Label>
                <Input
                  type="number"
                  value={newAttendees}
                  onChange={(e) => setNewAttendees(e.target.value)}
                  className="h-8 font-mono text-[13px]"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Descripcion
              </Label>
              <Textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                className="text-[13px]"
                placeholder="Tema principal de la asamblea..."
              />
            </div>

            {/* Decisions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Decisiones
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={addDecision}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Agregar
                </Button>
              </div>
              {newDecisions.map((d, idx) => (
                <div
                  key={idx}
                  className="rounded-md border border-border/50 bg-muted/20 p-3 space-y-2"
                >
                  <div className="flex items-start gap-2">
                    <Input
                      value={d.decision}
                      onChange={(e) =>
                        updateDecision(idx, "decision", e.target.value)
                      }
                      className="h-7 flex-1 text-[12px]"
                      placeholder="Descripcion de la decision"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7 shrink-0 text-muted-foreground/50 hover:text-destructive"
                      onClick={() => removeDecision(idx)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-[10px] text-muted-foreground">
                        A favor:
                      </Label>
                      <Input
                        type="number"
                        value={d.votes_for || ""}
                        onChange={(e) =>
                          updateDecision(
                            idx,
                            "votes_for",
                            Number(e.target.value) || 0
                          )
                        }
                        className="h-6 w-14 text-center font-mono text-[11px]"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-[10px] text-muted-foreground">
                        En contra:
                      </Label>
                      <Input
                        type="number"
                        value={d.votes_against || ""}
                        onChange={(e) =>
                          updateDecision(
                            idx,
                            "votes_against",
                            Number(e.target.value) || 0
                          )
                        }
                        className="h-6 w-14 text-center font-mono text-[11px]"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Label className="text-[10px] text-muted-foreground">
                        Aprobada:
                      </Label>
                      <Select
                        value={d.approved ? "yes" : "no"}
                        onValueChange={(v) =>
                          updateDecision(idx, "approved", v === "yes")
                        }
                      >
                        <SelectTrigger className="h-6 w-16 text-[10px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes" className="text-[11px]">
                            Si
                          </SelectItem>
                          <SelectItem value="no" className="text-[11px]">
                            No
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setCreateOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={saving}
                onClick={handleCreate}
              >
                {saving ? (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                ) : (
                  <FileText className="mr-1.5 h-3 w-3" />
                )}
                Registrar acta
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
