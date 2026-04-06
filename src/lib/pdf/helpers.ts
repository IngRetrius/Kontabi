const MONTHS_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const MONTHS_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export function fmtCOP(n: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export function fmtPeriod(period: string): string {
  const [year, month] = period.split("-");
  return `${MONTHS_LONG[Number(month) - 1]} ${year}`;
}

export function fmtPeriodShort(period: string): string {
  const [year, month] = period.split("-");
  return `${MONTHS_SHORT[Number(month) - 1]} ${year}`;
}

export function fmtPercent(n: number, decimals = 2): string {
  return `${n.toFixed(decimals)}%`;
}

export function today(): string {
  return new Date().toISOString().split("T")[0];
}
