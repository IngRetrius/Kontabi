import { Document, Page, View, Text } from "@react-pdf/renderer";
import { PdfHeader } from "@/components/pdf/pdf-header";
import { PdfFooter } from "@/components/pdf/pdf-footer";
import { baseStyles, PDF_COLORS } from "@/lib/pdf/styles";
import { fmtCOP, fmtDate, fmtPercent, today } from "@/lib/pdf/helpers";
import type { FondoReservaData } from "@/lib/reports/certifications";
import type { TenantHeaderData } from "@/lib/reports/report-header";

interface ReserveFundPdfProps {
  data: FondoReservaData;
  header: TenantHeaderData;
}

const s = baseStyles;

const STATUS_LABELS: Record<string, string> = {
  compliant: "Cumple",
  below_minimum: "Por debajo del minimo",
  critical: "Critico",
};

const STATUS_COLORS: Record<string, string> = {
  compliant: PDF_COLORS.payment,
  below_minimum: PDF_COLORS.warning,
  critical: PDF_COLORS.debt,
};

const colMov = {
  date: { width: "15%" },
  desc: { width: "40%" },
  type: { width: "15%" },
  amount: { width: "30%" },
};

export default function ReserveFundPdf({
  data,
  header,
}: ReserveFundPdfProps) {
  const pct =
    data.legalMinimum > 0
      ? (data.currentBalance / data.legalMinimum) * 100
      : 100;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <PdfHeader
          tenantName={header.tenantName}
          tenantNit={header.tenantNit}
          tenantAddress={header.tenantAddress}
          reportHeaderText={header.reportHeaderText}
          logoUrl={header.logoUrl || undefined}
          docTitle="FONDO DE RESERVA"
          docSubtitle="Art. 35 Ley 675 de 2001"
        />

        {/* Summary cards */}
        <View style={s.balanceRow}>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Saldo actual</Text>
            <Text style={s.balanceValue}>{fmtCOP(data.currentBalance)}</Text>
          </View>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Minimo legal</Text>
            <Text style={s.balanceValue}>{fmtCOP(data.legalMinimum)}</Text>
          </View>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Estado</Text>
            <Text
              style={[
                s.balanceValue,
                { color: STATUS_COLORS[data.status] ?? PDF_COLORS.text, fontSize: 11 },
              ]}
            >
              {STATUS_LABELS[data.status] ?? data.status}
            </Text>
          </View>
        </View>

        <View style={s.balanceRow}>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>% del presupuesto</Text>
            <Text style={s.balanceValue}>
              {fmtPercent(data.budgetPercentage)}
            </Text>
          </View>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Cobertura</Text>
            <Text
              style={[
                s.balanceValue,
                { color: pct >= 100 ? PDF_COLORS.payment : PDF_COLORS.debt },
              ]}
            >
              {fmtPercent(pct)}
            </Text>
          </View>
        </View>

        <View style={s.dividerThin} />

        {/* Movements */}
        {data.movements.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>
              Movimientos recientes ({data.movements.length})
            </Text>
            <View style={s.table}>
              <View style={s.tableHeaderRow}>
                <Text style={[s.th, colMov.date]}>Fecha</Text>
                <Text style={[s.th, colMov.desc]}>Descripcion</Text>
                <Text style={[s.th, colMov.type]}>Tipo</Text>
                <Text style={[s.thRight, colMov.amount]}>Monto</Text>
              </View>
              {data.movements.map((m, i) => (
                <View
                  key={i}
                  style={
                    i === data.movements.length - 1
                      ? s.tableRowLast
                      : i % 2 === 1
                        ? s.tableRowAlt
                        : s.tableRow
                  }
                >
                  <Text style={[s.td, colMov.date]}>{fmtDate(m.date)}</Text>
                  <Text style={[s.td, colMov.desc]}>{m.description}</Text>
                  <Text style={[s.td, colMov.type]}>
                    {m.type === "contribution" ? "Aporte" : "Retiro"}
                  </Text>
                  <Text
                    style={[
                      s.tdRight,
                      colMov.amount,
                      {
                        color:
                          m.type === "contribution"
                            ? PDF_COLORS.payment
                            : PDF_COLORS.debt,
                      },
                    ]}
                  >
                    {m.type === "withdrawal" ? "-" : ""}
                    {fmtCOP(m.amount)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={s.note}>
          Segun el Art. 35 de la Ley 675 de 2001, toda propiedad horizontal debe
          mantener un fondo de reserva equivalente al menos al{" "}
          {fmtPercent(data.budgetPercentage)} del presupuesto anual aprobado.
        </Text>

        <PdfFooter
          generatedDate={fmtDate(today())}
          adminName={header.adminName}
        />
      </Page>
    </Document>
  );
}
