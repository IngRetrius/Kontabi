const PRECISION = 1_000_000;
const TOTAL = 100 * PRECISION; // 100_000_000

export interface CoefficientEntry {
  id: string;
  coefficient: number;
  isLocked: boolean;
}

export interface CoefficientValidation {
  valid: boolean;
  sum: number;
  formatted: string;
}

/**
 * Distribute 100% equally among N units using integer arithmetic
 * to guarantee the sum is exactly 100.000000%.
 *
 * The first `remainder` units receive one extra micro-unit (0.000001%).
 */
export function distributeEqually(unitCount: number): number[] {
  if (unitCount <= 0) return [];
  if (unitCount === 1) return [100];

  const base = Math.floor(TOTAL / unitCount);
  const remainder = TOTAL - base * unitCount;

  return Array.from({ length: unitCount }, (_, i) =>
    (i < remainder ? base + 1 : base) / PRECISION
  );
}

/**
 * Rebalance coefficients: locked units keep their values,
 * unlocked units share the remaining percentage equally.
 *
 * If locked sum >= 100, unlocked units get 0.
 */
export function rebalance(
  entries: CoefficientEntry[]
): { id: string; coefficient: number }[] {
  const locked = entries.filter((e) => e.isLocked);
  const unlocked = entries.filter((e) => !e.isLocked);

  if (unlocked.length === 0) {
    return entries.map((e) => ({ id: e.id, coefficient: e.coefficient }));
  }

  const lockedSum = Math.round(
    locked.reduce((sum, e) => sum + e.coefficient * PRECISION, 0)
  );

  if (lockedSum >= TOTAL) {
    return entries.map((e) => ({
      id: e.id,
      coefficient: e.isLocked ? e.coefficient : 0,
    }));
  }

  const remaining = TOTAL - lockedSum;
  const base = Math.floor(remaining / unlocked.length);
  const rem = remaining - base * unlocked.length;

  const unlockedValues = new Map<string, number>();
  unlocked.forEach((e, i) => {
    unlockedValues.set(e.id, (i < rem ? base + 1 : base) / PRECISION);
  });

  return entries.map((e) => ({
    id: e.id,
    coefficient: e.isLocked ? e.coefficient : (unlockedValues.get(e.id) ?? 0),
  }));
}

/**
 * Validate that a set of coefficients sums to 100% within
 * floating-point tolerance (0.0001).
 */
export function validateCoefficientSum(
  coefficients: number[]
): CoefficientValidation {
  const sum = Math.round(
    coefficients.reduce((s, c) => s + c * PRECISION, 0)
  ) / PRECISION;

  return {
    valid: sum >= 99.9999 && sum <= 100.0001,
    sum,
    formatted: sum.toFixed(6),
  };
}
