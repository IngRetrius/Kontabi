import { format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Format a number as Colombian Pesos (COP).
 * Example: 1234567 -> "$1.234.567"
 */
export function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format a Date to a human-readable Spanish string.
 * Example: "15 de marzo de 2026"
 */
export function formatDate(date: Date): string {
  return format(date, "d 'de' MMMM 'de' yyyy", { locale: es });
}

/**
 * Format a short date.
 * Example: "15/03/2026"
 */
export function formatShortDate(date: Date): string {
  return format(date, "dd/MM/yyyy");
}

/**
 * Format a period string to a human-readable month/year.
 * Example: "2026-03" -> "Marzo 2026"
 */
export function formatPeriod(period: string): string {
  const [year, month] = period.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return format(date, "MMMM yyyy", { locale: es });
}

/**
 * Validate a Colombian NIT (9-10 digits).
 */
export function validateNIT(nit: string): boolean {
  const cleaned = nit.replace(/\D/g, "");
  return /^\d{9,10}$/.test(cleaned);
}

/**
 * Format a percentage with one decimal.
 * Example: 0.8567 -> "85.7%"
 */
export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Format a coefficient with 6 decimal places.
 * Example: 1.234567 -> "1.234567"
 */
export function formatCoefficient(value: number): string {
  return value.toFixed(6);
}
