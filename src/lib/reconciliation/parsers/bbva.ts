import type { ParsedStatementLine } from "@/types/database";
import type { BankParser } from "./types";
import { buildParseResult, parseDate, parseAmount, normalizeHeaders } from "./types";

export const bbvaParser: BankParser = {
  bank: "bbva",

  detect(headers: string[]): boolean {
    const normalized = normalizeHeaders(headers);
    const joined = normalized.join(" ");

    if (joined.includes("bbva")) return true;

    // BBVA Colombia uses: Fecha, Concepto, Referencia, Valor, Saldo
    // with a single "Valor" column (negative = debit, positive = credit)
    const hasDate = normalized.some((h) => h.includes("fecha"));
    const hasConcept = normalized.some(
      (h) => h.includes("concepto") || h.includes("movimiento")
    );
    const hasValue = normalized.some(
      (h) => h === "valor" || h === "monto" || h === "importe"
    );
    const noSeparateColumns =
      !normalized.some((h) => h.includes("debito")) &&
      !normalized.some((h) => h.includes("credito"));

    return hasDate && hasConcept && hasValue && noSeparateColumns;
  },

  parse(rows: string[][]) {
    const errors: string[] = [];
    const lines: ParsedStatementLine[] = [];

    if (rows.length < 2) {
      return buildParseResult("bbva", [], ["Archivo vacio o sin datos"]);
    }

    const headers = normalizeHeaders(rows[0]);

    const dateIdx = headers.findIndex((h) => h.includes("fecha"));
    const descIdx = headers.findIndex(
      (h) => h.includes("concepto") || h.includes("movimiento") || h.includes("descripcion")
    );
    const refIdx = headers.findIndex((h) => h.includes("referencia") || h.includes("numero"));
    const valueIdx = headers.findIndex(
      (h) => h === "valor" || h === "monto" || h === "importe"
    );
    const balanceIdx = headers.findIndex((h) => h.includes("saldo"));

    if (dateIdx === -1 || valueIdx === -1) {
      return buildParseResult("bbva", [], ["No se encontraron columnas de fecha o valor"]);
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((cell) => !cell.trim())) continue;

      const rawDate = row[dateIdx]?.trim() ?? "";
      const date = parseDate(rawDate);
      if (!date) {
        errors.push(`Fila ${i + 1}: fecha invalida "${rawDate}"`);
        continue;
      }

      const description = descIdx >= 0 ? row[descIdx]?.trim() ?? "" : "";
      const reference = refIdx >= 0 ? row[refIdx]?.trim() ?? "" : "";
      const balance = balanceIdx >= 0 ? parseAmount(row[balanceIdx] ?? "0") : undefined;

      const rawVal = parseAmount(row[valueIdx] ?? "0");
      if (rawVal === 0) {
        errors.push(`Fila ${i + 1}: valor cero o invalido`);
        continue;
      }

      const amount = Math.abs(rawVal);
      const type = rawVal < 0 ? "debit" as const : "credit" as const;

      lines.push({
        date,
        description,
        reference,
        amount,
        type,
        balance,
        rawData: Object.fromEntries(headers.map((h, idx) => [h, row[idx] ?? ""])),
      });
    }

    return buildParseResult("bbva", lines, errors);
  },
};
