import { Document, Page, View, Text } from "@react-pdf/renderer";
import { PdfHeader } from "@/components/pdf/pdf-header";
import { PdfFooter } from "@/components/pdf/pdf-footer";
import { baseStyles, PDF_COLORS } from "@/lib/pdf/styles";
import { fmtCOP, fmtPeriod, fmtDate, today } from "@/lib/pdf/helpers";
import type { IncomeStatementData } from "@/lib/reports/income-statement";
import type { TenantHeaderData } from "@/lib/reports/report-header";

interface IncomeStatementPdfProps {
  data: IncomeStatementData;
  header: TenantHeaderData;
}

const s = baseStyles;

const col = {
  code: { width: "15%" },
  name: { width: "55%" },
  amount: { width: "30%" },
};

export default function IncomeStatementPdf({
  data,
  header,
}: IncomeStatementPdfProps) {
  const resultColor =
    data.netResult >= 0 ? PDF_COLORS.payment : PDF_COLORS.debt;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <PdfHeader
          tenantName={header.tenantName}
          tenantNit={header.tenantNit}
          tenantAddress={header.tenantAddress}
          reportHeaderText={header.reportHeaderText}
          logoUrl={header.logoUrl || undefined}
          docTitle="ESTADO DE RESULTADOS"
          docSubtitle={fmtPeriod(data.period)}
        />

        {/* Income section */}
        <Text style={s.sectionTitle}>Ingresos</Text>
        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.th, col.code]}>Codigo</Text>
            <Text style={[s.th, col.name]}>Cuenta</Text>
            <Text style={[s.thRight, col.amount]}>Valor</Text>
          </View>
          {data.income.map((line, i) => (
            <View
              key={line.accountCode}
              style={
                i === data.income.length - 1 ? s.tableRowLast : s.tableRow
              }
            >
              <Text style={[s.td, col.code]}>{line.accountCode}</Text>
              <Text style={[s.td, col.name]}>{line.accountName}</Text>
              <Text style={[s.tdRight, col.amount]}>{fmtCOP(line.total)}</Text>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={[s.tdBold, col.code]} />
            <Text style={[s.tdBold, col.name]}>Total Ingresos</Text>
            <Text style={[s.tdRightBold, col.amount, { color: PDF_COLORS.payment }]}>
              {fmtCOP(data.totalIncome)}
            </Text>
          </View>
        </View>

        <View style={s.dividerThin} />

        {/* Expenses section */}
        <Text style={s.sectionTitle}>Gastos</Text>
        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.th, col.code]}>Codigo</Text>
            <Text style={[s.th, col.name]}>Cuenta</Text>
            <Text style={[s.thRight, col.amount]}>Valor</Text>
          </View>
          {data.expenses.map((line, i) => (
            <View
              key={line.accountCode}
              style={
                i === data.expenses.length - 1 ? s.tableRowLast : s.tableRow
              }
            >
              <Text style={[s.td, col.code]}>{line.accountCode}</Text>
              <Text style={[s.td, col.name]}>{line.accountName}</Text>
              <Text style={[s.tdRight, col.amount]}>{fmtCOP(line.total)}</Text>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={[s.tdBold, col.code]} />
            <Text style={[s.tdBold, col.name]}>Total Gastos</Text>
            <Text style={[s.tdRightBold, col.amount, { color: PDF_COLORS.debt }]}>
              {fmtCOP(data.totalExpenses)}
            </Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* Net result */}
        <View style={s.balanceRow}>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Total Ingresos</Text>
            <Text style={[s.balanceValue, { color: PDF_COLORS.payment }]}>
              {fmtCOP(data.totalIncome)}
            </Text>
          </View>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Total Gastos</Text>
            <Text style={[s.balanceValue, { color: PDF_COLORS.debt }]}>
              {fmtCOP(data.totalExpenses)}
            </Text>
          </View>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>
              {data.netResult >= 0 ? "Excedente" : "Deficit"}
            </Text>
            <Text style={[s.balanceValue, { color: resultColor }]}>
              {fmtCOP(Math.abs(data.netResult))}
            </Text>
          </View>
        </View>

        <Text style={s.note}>
          Preparado bajo NIIF para PYMES - Grupo 3. Cifras en pesos colombianos
          (COP).
        </Text>

        <PdfFooter
          generatedDate={fmtDate(today())}
          adminName={header.adminName}
        />
      </Page>
    </Document>
  );
}
