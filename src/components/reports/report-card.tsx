"use client";

import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, FileOutput } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface ReportCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  iconClassName?: string;
  onGenerate: () => void;
  loading: boolean;
  disabled?: boolean;
  children?: ReactNode;
  index?: number;
}

export function ReportCard({
  icon: Icon,
  title,
  description,
  iconClassName,
  onGenerate,
  loading,
  disabled,
  children,
  index = 0,
}: ReportCardProps) {
  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-xl border bg-card p-5",
        "shadow-sm transition-all duration-200",
        "hover:shadow-md hover:-translate-y-0.5 hover:border-foreground/15"
      )}
      style={{
        animation: `reportCardIn 0.4s ease-out ${index * 70}ms both`,
      }}
    >
      <div className="mb-3 flex items-start gap-3.5">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            iconClassName ?? "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[13px] font-semibold leading-tight tracking-tight">
            {title}
          </h3>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
      </div>

      {children && <div className="mb-3 space-y-2">{children}</div>}

      <div className="mt-auto pt-2">
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs font-medium"
          onClick={onGenerate}
          disabled={loading || disabled}
        >
          {loading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileOutput className="mr-1.5 h-3.5 w-3.5" />
          )}
          {loading ? "Generando..." : "Generar reporte"}
        </Button>
      </div>
    </div>
  );
}
