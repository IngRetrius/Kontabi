import { Document, Page, View, Text } from "@react-pdf/renderer";
import { PdfHeader } from "@/components/pdf/pdf-header";
import { PdfFooter } from "@/components/pdf/pdf-footer";
import { baseStyles, PDF_COLORS } from "@/lib/pdf/styles";
import { fmtCOP, fmtPercent, fmtDate, today } from "@/lib/pdf/helpers";
import type { BudgetExecutionReportData } from "@/lib/reports/budget-execution-report";
import type { TenantHeaderData } from "@/lib/reports/report-header";

interface BudgetExecutionPdfProps {
  data: BudgetExecutionReportData;
  header: TenantHeaderData;
}

const s = baseStyles;

const col = {
  name: { width: "25%" },
  budgeted: { width: "17%" },
  executed: { width: "17%" },
  variance: { width: "17%" },
  pct: { width: "12%" },
  status: { width: "12%" },
};

const SEMAPHORE_COLORS: Record<string, string> = {
  green: PDF_COLORS.payment,
  yellow: PDF_COLORS.warning,
  red: PDF_COLORS.debt,
};

const SEMAPHORE_LABELS: Record<string, string> = {
  green: "Normal",
  yellow: "Alerta",
  red: "Excedido",
};

export default function BudgetExecutionPdf({
  data,
  header,
}: BudgetExecutionPdfProps) {
  const { execution } = data;

  // Group items by category
  const categories = new Map<string, typeof execution.items>();
  for (const item of execution.items) {
    const cat = item.category || "Sin categoria";
    const list = categories.get(cat) ?? [];
    list.push(item);
    categories.set(cat, list);
  }

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <PdfHeader
          tenantName={header.tenantName}
          tenantNit={header.tenantNit}
          tenantAddress={header.tenantAddress}
          reportHeaderText={header.reportHeaderText}
          logoUrl={header.logoUrl || undefined}
          docTitle="EJECUCION PRESUPUESTAL"
          docSubtitle={`${data.budgetName} - Corte mes ${execution.monthsElapsed}`}
        />

        {/* Summary cards */}
        <View style={s.balanceRow}>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Presupuestado acum.</Text>
            <Text style={s.balanceValue}>
              {fmtCOP(execution.totalBudgeted)}
            </Text>
          </View>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Ejecutado acum.</Text>
            <Text style={s.balanceValue}>
              {fmtCOP(execution.totalExecuted)}
            </Text>
          </View>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Ejecucion</Text>
            <Text style={s.balanceValue}>
              {fmtPercent(execution.totalExecutionPct)}
            </Text>
          </View>
        </View>

        {/* Detail by category */}
        {Array.from(categories.entries()).map(([catName, items]) => (
          <View key={catName} wrap={false}>
            <Text style={s.sectionTitle}>{catName}</Text>
            <View style={s.table}>
              <View style={s.tableHeaderRow}>
                <Text style={[s.th, col.name]}>Rubro</Text>
                <Text style={[s.thRight, col.budgeted]}>Presupuesto</Text>
                <Text style={[s.thRight, col.executed]}>Ejecutado</Text>
                <Text style={[s.thRight, col.variance]}>Variacion</Text>
                <Text style={[s.thRight, col.pct]}>%</Text>
                <Text style={[s.th, col.status]}>Estado</Text>
              </View>
              {items.map((item, i) => (
                <View
                  key={item.itemId}
                  style={
                    i === items.length - 1
                      ? s.tableRowLast
                      : i % 2 === 1
                        ? s.tableRowAlt
                        : s.tableRow
                  }
                >
                  <Text style={[s.td, col.name]}>{item.itemName}</Text>
                  <Text style={[s.tdRight, col.budgeted]}>
                    {fmtCOP(item.budgetedAccumulated)}
                  </Text>
                  <Text style={[s.tdRight, col.executed]}>
                    {fmtCOP(item.executedAccumulated)}
                  </Text>
                  <Text
                    style={[
                      s.tdRight,
                      col.variance,
                      {
                        color:
                          item.variance > 0
                            ? PDF_COLORS.debt
                            : PDF_COLORS.payment,
                      },
                    ]}
                  >
                    {fmtCOP(item.variance)}
                  </Text>
                  <Text style={[s.tdRight, col.pct]}>
                    {fmtPercent(item.executionPct)}
                  </Text>
                  <Text
                    style={[
                      s.td,
                      col.status,
                      { color: SEMAPHORE_COLORS[item.semaphore] ?? PDF_COLORS.text },
                    ]}
                  >
                    {SEMAPHORE_LABELS[item.semaphore] ?? item.semaphore}
                  </Text>
                </View>
              ))}
            </View>
            <View style={s.dividerThin} />
          </View>
        ))}

        {/* Totals */}
        <View style={s.table}>
          <View style={s.totalRow}>
            <Text style={[s.tdBold, col.name]}>TOTAL GENERAL</Text>
            <Text style={[s.tdRightBold, col.budgeted]}>
              {fmtCOP(execution.totalBudgeted)}
            </Text>
            <Text style={[s.tdRightBold, col.executed]}>
              {fmtCOP(execution.totalExecuted)}
            </Text>
            <Text
              style={[
                s.tdRightBold,
                col.variance,
                {
                  color:
                    execution.totalVariance > 0
                      ? PDF_COLORS.debt
                      : PDF_COLORS.payment,
                },
              ]}
            >
              {fmtCOP(execution.totalVariance)}
            </Text>
            <Text style={[s.tdRightBold, col.pct]}>
              {fmtPercent(execution.totalExecutionPct)}
            </Text>
            <Text style={[s.tdBold, col.status]} />
          </View>
        </View>

        {execution.overBudgetAlerts.length > 0 && (
          <Text style={[s.note, { color: PDF_COLORS.debt }]}>
            Rubros con sobreejecucion (&gt;115%):{" "}
            {execution.overBudgetAlerts.map((a) => a.itemName).join(", ")}
          </Text>
        )}

        <PdfFooter
          generatedDate={fmtDate(today())}
          adminName={header.adminName}
        />
      </Page>
    </Document>
  );
}
