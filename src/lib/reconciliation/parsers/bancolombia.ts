import type { ParsedStatementLine } from "@/types/database";
import type { BankParser } from "./types";
import { buildParseResult, parseDate, parseAmount, normalizeHeaders } from "./types";

const KNOWN_HEADERS = [
  "fecha",
  "descripcion",
  "referencia",
  "valor",
  "saldo",
];

const BANCOLOMBIA_IDENTIFIERS = [
  "bancolombia",
  "sucursal",
  "oficina",
];

export const bancolombiaParser: BankParser = {
  bank: "bancolombia",

  detect(headers: string[]): boolean {
    const normalized = normalizeHeaders(headers);
    const joined = normalized.join(" ");

    // Check for Bancolombia-specific identifiers
    if (BANCOLOMBIA_IDENTIFIERS.some((id) => joined.includes(id))) {
      return true;
    }

    // Check for Bancolombia's typical header pattern
    const hasDate = normalized.some((h) => h.includes("fecha"));
    const hasDesc = normalized.some((h) => h.includes("descripcion") || h.includes("concepto"));
    const hasRef = normalized.some((h) => h.includes("referencia") || h.includes("documento"));
    const hasVal = normalized.some(
      (h) => h.includes("valor") || h.includes("debito") || h.includes("credito")
    );

    // Bancolombia typically has separate debit/credit columns
    const hasSeparateColumns =
      normalized.some((h) => h.includes("debito")) &&
      normalized.some((h) => h.includes("credito"));

    return hasDate && hasDesc && (hasRef || hasVal) && hasSeparateColumns;
  },

  parse(rows: string[][]) {
    const errors: string[] = [];
    const lines: ParsedStatementLine[] = [];

    if (rows.length < 2) {
      return buildParseResult("bancolombia", [], ["Archivo vacio o sin datos"]);
    }

    const headers = normalizeHeaders(rows[0]);

    // Find column indices
    const dateIdx = headers.findIndex((h) => h.includes("fecha"));
    const descIdx = headers.findIndex((h) => h.includes("descripcion") || h.includes("concepto"));
    const refIdx = headers.findIndex((h) => h.includes("referencia") || h.includes("documento"));
    const debitIdx = headers.findIndex((h) => h.includes("debito"));
    const creditIdx = headers.findIndex((h) => h.includes("credito"));
    const balanceIdx = headers.findIndex((h) => h.includes("saldo"));

    // If no separate debit/credit, look for single value column
    const valueIdx = debitIdx === -1 ? headers.findIndex((h) => h.includes("valor") || h.includes("monto")) : -1;

    if (dateIdx === -1) {
      return buildParseResult("bancolombia", [], ["No se encontro columna de fecha"]);
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

      const description = row[descIdx]?.trim() ?? "";
      const reference = refIdx >= 0 ? row[refIdx]?.trim() ?? "" : "";
      const balance = balanceIdx >= 0 ? parseAmount(row[balanceIdx] ?? "0") : undefined;

      let amount: number;
      let type: "debit" | "credit";

      if (debitIdx >= 0 && creditIdx >= 0) {
        const debitVal = parseAmount(row[debitIdx] ?? "0");
        const creditVal = parseAmount(row[creditIdx] ?? "0");
        if (debitVal > 0) {
          amount = debitVal;
          type = "debit";
        } else if (creditVal > 0) {
          amount = creditVal;
          type = "credit";
        } else {
          errors.push(`Fila ${i + 1}: sin valor en debito ni credito`);
          continue;
        }
      } else if (valueIdx >= 0) {
        const val = parseAmount(row[valueIdx] ?? "0");
        amount = Math.abs(val);
        type = val < 0 ? "debit" : "credit";
      } else {
        errors.push(`Fila ${i + 1}: no se encontraron columnas de valor`);
        continue;
      }

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

    return buildParseResult("bancolombia", lines, errors);
  },
};
