import type { BankFormat, ParseResult } from "@/types/database";
import type { BankParser } from "./types";
import { normalizeHeaders } from "./types";
import { bancolombiaParser } from "./bancolombia";
import { daviviendaParser } from "./davivienda";
import { bbvaParser } from "./bbva";
import { genericParser } from "./generic";

const PARSERS: BankParser[] = [
  bancolombiaParser,
  daviviendaParser,
  bbvaParser,
];

export function detectBank(headers: string[]): BankFormat {
  for (const parser of PARSERS) {
    if (parser.detect(headers)) {
      return parser.bank;
    }
  }
  return "generic";
}

function getParser(bank: BankFormat): BankParser {
  switch (bank) {
    case "bancolombia":
      return bancolombiaParser;
    case "davivienda":
      return daviviendaParser;
    case "bbva":
      return bbvaParser;
    default:
      return genericParser;
  }
}

export function parseCSVContent(content: string): string[][] {
  const lines = content.split(/\r?\n/);
  return lines.map((line) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((char === "," || char === ";") && !inQuotes) {
        cells.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells;
  });
}

export function parseStatement(
  content: string,
  forcedBank?: BankFormat
): ParseResult {
  const rows = parseCSVContent(content);

  // Skip empty leading rows (some banks add header text before the actual CSV)
  let startIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (row && row.length >= 3 && row.some((cell) => cell.trim())) {
      const normalized = normalizeHeaders(row);
      const looksLikeHeader = normalized.some(
        (h) =>
          h.includes("fecha") ||
          h.includes("date") ||
          h.includes("descripcion") ||
          h.includes("concepto")
      );
      if (looksLikeHeader) {
        startIdx = i;
        break;
      }
    }
  }

  const dataRows = rows.slice(startIdx).filter((r) => r.some((c) => c.trim()));

  if (dataRows.length < 2) {
    return {
      bank: forcedBank ?? "generic",
      lines: [],
      totalDebits: 0,
      totalCredits: 0,
      errors: ["El archivo no contiene datos suficientes"],
    };
  }

  const bank = forcedBank ?? detectBank(dataRows[0]);
  const parser = getParser(bank);
  return parser.parse(dataRows);
}

export { detectBank as detectBankFormat };
export type { BankParser } from "./types";
