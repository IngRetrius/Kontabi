import { Document, Page, View, Text } from "@react-pdf/renderer";
import { PdfHeader } from "@/components/pdf/pdf-header";
import { PdfFooter } from "@/components/pdf/pdf-footer";
import { baseStyles, PDF_COLORS } from "@/lib/pdf/styles";
import { fmtCOP, fmtDate, today } from "@/lib/pdf/helpers";
import type { AgingReportData } from "@/lib/reports/aging-report";
import type { TenantHeaderData } from "@/lib/reports/report-header";

interface AgingReportPdfProps {
  data: AgingReportData;
  header: TenantHeaderData;
}

const s = baseStyles;

const colAging = {
  range: { width: "30%" },
  count: { width: "15%" },
  amount: { width: "25%" },
  provision: { width: "30%" },
};

const colUnit = {
  unit: { width: "25%" },
  balance: { width: "30%" },
  bucket: { width: "45%" },
};

export default function AgingReportPdf({
  data,
  header,
}: AgingReportPdfProps) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <PdfHeader
          tenantName={header.tenantName}
          tenantNit={header.tenantNit}
          tenantAddress={header.tenantAddress}
          reportHeaderText={header.reportHeaderText}
          logoUrl={header.logoUrl || undefined}
          docTitle="CARTERA POR EDADES"
          docSubtitle={`Corte: ${fmtDate(today())}`}
        />

        {/* Summary cards */}
        <View style={s.balanceRow}>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Total cartera</Text>
            <Text style={[s.balanceValue, { color: PDF_COLORS.debt }]}>
              {fmtCOP(data.totalOutstanding)}
            </Text>
          </View>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Provision estimada</Text>
            <Text style={[s.balanceValue, { color: PDF_COLORS.warning }]}>
              {fmtCOP(data.totalProvision)}
            </Text>
          </View>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Unidades en mora</Text>
            <Text style={s.balanceValue}>{data.unitsWithDebt}</Text>
          </View>
        </View>

        {/* Aging summary table */}
        <Text style={s.sectionTitle}>Resumen por antiguedad</Text>
        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.th, colAging.range]}>Rango</Text>
            <Text style={[s.thRight, colAging.count]}>Cobros</Text>
            <Text style={[s.thRight, colAging.amount]}>Monto</Text>
            <Text style={[s.thRight, colAging.provision]}>
              Provision (%)
            </Text>
          </View>
          {data.aging
            .filter((a) => a.amount > 0)
            .map((a, i, arr) => (
              <View
                key={a.bucket}
                style={
                  i === arr.length - 1
                    ? s.tableRowLast
                    : i % 2 === 1
                      ? s.tableRowAlt
                      : s.tableRow
                }
              >
                <Text style={[s.td, colAging.range]}>{a.label}</Text>
                <Text style={[s.tdRight, colAging.count]}>{a.count}</Text>
                <Text style={[s.tdRight, colAging.amount]}>
                  {fmtCOP(a.amount)}
                </Text>
                <Text style={[s.tdRight, colAging.provision]}>
                  {fmtCOP(a.provision_amount)} ({a.provision_pct}%)
                </Text>
              </View>
            ))}
          <View style={s.totalRow}>
            <Text style={[s.tdBold, colAging.range]}>TOTAL</Text>
            <Text style={[s.tdRightBold, colAging.count]}>
              {data.aging.reduce((s, a) => s + a.count, 0)}
            </Text>
            <Text style={[s.tdRightBold, colAging.amount]}>
              {fmtCOP(data.totalOutstanding)}
            </Text>
            <Text style={[s.tdRightBold, colAging.provision]}>
              {fmtCOP(data.totalProvision)}
            </Text>
          </View>
        </View>

        <View style={s.dividerThin} />

        {/* Top debtors by unit */}
        {data.byUnit.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>
              Detalle por unidad ({data.byUnit.length} unidades)
            </Text>
            <View style={s.table}>
              <View style={s.tableHeaderRow}>
                <Text style={[s.th, colUnit.unit]}>Unidad</Text>
                <Text style={[s.thRight, colUnit.balance]}>Saldo</Text>
                <Text style={[s.th, colUnit.bucket]}>Clasificacion</Text>
              </View>
              {data.byUnit.slice(0, 30).map((u, i, arr) => (
                <View
                  key={u.unitId}
                  style={
                    i === arr.length - 1
                      ? s.tableRowLast
                      : i % 2 === 1
                        ? s.tableRowAlt
                        : s.tableRow
                  }
                >
                  <Text style={[s.tdBold, colUnit.unit]}>{u.unitNumber}</Text>
                  <Text style={[s.tdRight, colUnit.balance, { color: PDF_COLORS.debt }]}>
                    {fmtCOP(u.balance)}
                  </Text>
                  <Text style={[s.td, colUnit.bucket]}>{u.bucket}</Text>
                </View>
              ))}
            </View>
            {data.byUnit.length > 30 && (
              <Text style={s.note}>
                Mostrando las 30 unidades con mayor saldo de{" "}
                {data.byUnit.length} totales.
              </Text>
            )}
          </View>
        )}

        <PdfFooter
          generatedDate={fmtDate(today())}
          adminName={header.adminName}
        />
      </Page>
    </Document>
  );
}
