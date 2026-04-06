import type { ParsedStatementLine, BankFormat, ParseResult } from "@/types/database";

export interface BankParser {
  bank: BankFormat;
  detect(headers: string[]): boolean;
  parse(rows: string[][]): ParseResult;
}

export function buildParseResult(
  bank: BankFormat,
  lines: ParsedStatementLine[],
  errors: string[]
): ParseResult {
  let totalDebits = 0;
  let totalCredits = 0;

  for (const line of lines) {
    if (line.type === "debit") {
      totalDebits += Math.abs(line.amount);
    } else {
      totalCredits += Math.abs(line.amount);
    }
  }

  return { bank, lines, totalDebits, totalCredits, errors };
}

export function parseDate(raw: string): string | null {
  // Try DD/MM/YYYY
  const ddmmyyyy = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (ddmmyyyy) {
    const [, d, m, y] = ddmmyyyy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Try YYYY-MM-DD
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return raw;

  // Try YYYY/MM/DD
  const yyyymmdd = raw.match(/^(\d{4})[/.](\d{2})[/.](\d{2})$/);
  if (yyyymmdd) {
    const [, y, m, d] = yyyymmdd;
    return `${y}-${m}-${d}`;
  }

  return null;
}

export function parseAmount(raw: string): number {
  // Remove currency symbols, spaces, thousand separators (. or ,)
  // Colombian format: 1.234.567,89 or 1234567.89
  let cleaned = raw.replace(/[$\s]/g, "").trim();

  // If contains both . and , determine which is decimal
  if (cleaned.includes(",") && cleaned.includes(".")) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) {
      // 1.234,56 format (Colombian/European)
      cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,234.56 format (US)
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(",")) {
    // Could be decimal separator: 1234,56
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      cleaned = cleaned.replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  }

  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

export function normalizeHeaders(headers: string[]): string[] {
  return headers.map((h) =>
    h
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
  );
}
