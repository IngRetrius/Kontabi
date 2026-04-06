import { getGlobalAging } from "@/lib/accounting/account-statement";
import type { AgingEntry, AgingBucket } from "@/types/database";

export interface AgingReportUnit {
  unitId: string;
  unitNumber: string;
  balance: number;
  bucket: AgingBucket;
}

export interface AgingReportData {
  aging: AgingEntry[];
  byUnit: AgingReportUnit[];
  totalOutstanding: number;
  totalProvision: number;
  unitsWithDebt: number;
}

export async function generateAgingReport(): Promise<{
  data: AgingReportData | null;
  error: string | null;
}> {
  const { aging, byUnit, error } = await getGlobalAging();

  if (error) return { data: null, error };

  const totalOutstanding = aging.reduce((s, a) => s + a.amount, 0);
  const totalProvision = aging.reduce((s, a) => s + a.provision_amount, 0);

  return {
    data: {
      aging,
      byUnit,
      totalOutstanding,
      totalProvision,
      unitsWithDebt: byUnit.length,
    },
    error: null,
  };
}

