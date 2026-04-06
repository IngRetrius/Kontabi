import type { ParsedStatementLine } from "@/types/database";
import type { BankParser } from "./types";
import { buildParseResult, parseDate, parseAmount, normalizeHeaders } from "./types";

export const daviviendaParser: BankParser = {
  bank: "davivienda",

  detect(headers: string[]): boolean {
    const normalized = normalizeHeaders(headers);
    const joined = normalized.join(" ");

    if (joined.includes("davivienda")) return true;

    // Davivienda typically uses: Fecha, Descripcion, Referencia, Debitos, Creditos, Saldo
    const hasDate = normalized.some((h) => h.includes("fecha"));
    const hasDesc = normalized.some((h) => h.includes("descripcion") || h.includes("detalle"));
    const hasDebits = normalized.some((h) => h.includes("debitos") || h.includes("cargos"));
    const hasCredits = normalized.some((h) => h.includes("creditos") || h.includes("abonos"));

    return hasDate && hasDesc && hasDebits && hasCredits;
  },

  parse(rows: string[][]) {
    const errors: string[] = [];
    const lines: ParsedStatementLine[] = [];

    if (rows.length < 2) {
      return buildParseResult("davivienda", [], ["Archivo vacio o sin datos"]);
    }

    const headers = normalizeHeaders(rows[0]);

    const dateIdx = headers.findIndex((h) => h.includes("fecha"));
    const descIdx = headers.findIndex(
      (h) => h.includes("descripcion") || h.includes("detalle") || h.includes("concepto")
    );
    const refIdx = headers.findIndex((h) => h.includes("referencia") || h.includes("numero"));
    const debitIdx = headers.findIndex((h) => h.includes("debito") || h.includes("cargo"));
    const creditIdx = headers.findIndex((h) => h.includes("credito") || h.includes("abono"));
    const balanceIdx = headers.findIndex((h) => h.includes("saldo"));

    if (dateIdx === -1) {
      return buildParseResult("davivienda", [], ["No se encontro columna de fecha"]);
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

      const debitVal = debitIdx >= 0 ? parseAmount(row[debitIdx] ?? "0") : 0;
      const creditVal = creditIdx >= 0 ? parseAmount(row[creditIdx] ?? "0") : 0;

      let amount: number;
      let type: "debit" | "credit";

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

    return buildParseResult("davivienda", lines, errors);
  },
};
