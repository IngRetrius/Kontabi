import type { ParsedStatementLine } from "@/types/database";
import type { BankParser } from "./types";
import { buildParseResult, parseDate, parseAmount, normalizeHeaders } from "./types";

export const genericParser: BankParser = {
  bank: "generic",

  detect(): boolean {
    // Generic is always a fallback — never auto-detected
    return false;
  },

  parse(rows: string[][]) {
    const errors: string[] = [];
    const lines: ParsedStatementLine[] = [];

    if (rows.length < 2) {
      return buildParseResult("generic", [], ["Archivo vacio o sin datos"]);
    }

    const headers = normalizeHeaders(rows[0]);

    // Try to find columns flexibly
    const dateIdx = headers.findIndex(
      (h) => h.includes("fecha") || h.includes("date") || h === "f"
    );
    const descIdx = headers.findIndex(
      (h) =>
        h.includes("descripcion") ||
        h.includes("description") ||
        h.includes("concepto") ||
        h.includes("detalle")
    );
    const refIdx = headers.findIndex(
      (h) => h.includes("referencia") || h.includes("reference") || h.includes("ref")
    );

    // Look for value columns
    const debitIdx = headers.findIndex(
      (h) => h.includes("debito") || h.includes("debit") || h.includes("cargo")
    );
    const creditIdx = headers.findIndex(
      (h) => h.includes("credito") || h.includes("credit") || h.includes("abono")
    );
    const valueIdx = headers.findIndex(
      (h) =>
        h === "valor" ||
        h === "monto" ||
        h === "amount" ||
        h === "value" ||
        h === "importe"
    );
    const balanceIdx = headers.findIndex(
      (h) => h.includes("saldo") || h.includes("balance")
    );

    const hasSeparateColumns = debitIdx >= 0 && creditIdx >= 0;

    if (dateIdx === -1) {
      return buildParseResult("generic", [], [
        "No se encontro columna de fecha. Columnas esperadas: fecha, descripcion, valor (o debito/credito)",
      ]);
    }

    if (!hasSeparateColumns && valueIdx === -1) {
      return buildParseResult("generic", [], [
        "No se encontraron columnas de valor. Use 'valor' para una sola columna o 'debito'/'credito' para columnas separadas",
      ]);
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

      const description = descIdx >= 0 ? row[descIdx]?.trim() ?? "" : `Linea ${i}`;
      const reference = refIdx >= 0 ? row[refIdx]?.trim() ?? "" : "";
      const balance = balanceIdx >= 0 ? parseAmount(row[balanceIdx] ?? "0") : undefined;

      let amount: number;
      let type: "debit" | "credit";

      if (hasSeparateColumns) {
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
      } else {
        const val = parseAmount(row[valueIdx] ?? "0");
        if (val === 0) {
          errors.push(`Fila ${i + 1}: valor cero o invalido`);
          continue;
        }
        amount = Math.abs(val);
        type = val < 0 ? "debit" : "credit";
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

    return buildParseResult("generic", lines, errors);
  },
};
