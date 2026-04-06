import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";
import type { ReconciliationReport } from "@/lib/reconciliation/report";

function fmtCOP(n: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function fmtPeriod(period: string): string {
  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];
  const [year, month] = period.split("-");
  return `${months[Number(month) - 1]} ${year}`;
}

const c = {
  text: "#111827",
  muted: "#6b7280",
  border: "#d1d5db",
  borderLight: "#e5e7eb",
  headerBg: "#f9fafb",
  altRow: "#f9fafb",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: c.text,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  tenantName: { fontFamily: "Helvetica-Bold", fontSize: 14, marginBottom: 2 },
  tenantDetail: { fontSize: 8, color: c.muted, marginBottom: 1 },
  docTitle: { fontFamily: "Helvetica-Bold", fontSize: 12, textAlign: "right" },
  docSubtitle: { fontSize: 8, color: c.muted, textAlign: "right", marginTop: 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: c.border, marginVertical: 10 },
  sectionTitle: { fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 6, marginTop: 4 },

  // Balance summary
  balanceRow: { flexDirection: "row", gap: 12, marginVertical: 8 },
  balanceCard: { flex: 1, borderWidth: 1, borderColor: c.borderLight, borderRadius: 4, padding: 8 },
  balanceLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: c.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  balanceValue: { fontSize: 13, fontFamily: "Helvetica-Bold" },

  // Table
  table: { borderWidth: 1, borderColor: c.borderLight, borderRadius: 2 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: c.headerBg, borderBottomWidth: 1, borderBottomColor: c.borderLight },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: c.borderLight },
  tableRowLast: { flexDirection: "row" },
  th: { fontSize: 7, fontFamily: "Helvetica-Bold", color: c.muted, textTransform: "uppercase", letterSpacing: 0.4, paddingVertical: 5, paddingHorizontal: 6 },
  thRight: { fontSize: 7, fontFamily: "Helvetica-Bold", color: c.muted, textTransform: "uppercase", letterSpacing: 0.4, textAlign: "right", paddingVertical: 5, paddingHorizontal: 6 },
  td: { fontSize: 8, paddingVertical: 4, paddingHorizontal: 6 },
  tdRight: { fontSize: 8, textAlign: "right", paddingVertical: 4, paddingHorizontal: 6 },
  tdBold: { fontSize: 8, fontFamily: "Helvetica-Bold", paddingVertical: 4, paddingHorizontal: 6 },
  tdRightBold: { fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "right", paddingVertical: 4, paddingHorizontal: 6 },

  // Columns
  colDate: { width: "15%" },
  colDesc: { width: "55%" },
  colAmount: { width: "30%" },

  // Footer
  footer: { position: "absolute", bottom: 30, left: 40, right: 40 },
  footerDivider: { borderBottomWidth: 0.5, borderBottomColor: c.borderLight, marginBottom: 6 },
  footerRow: { flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: c.muted },

  // Signatures
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 40 },
  sigBlock: { width: 200 },
  sigLine: { borderTopWidth: 1, borderTopColor: c.text, paddingTop: 4 },
  sigLabel: { fontSize: 8, color: c.muted },
});

interface ReconciliationReportPdfProps {
  data: ReconciliationReport;
  tenantName: string;
  tenantNit: string;
  tenantAddress: string;
}

export default function ReconciliationReportPdf({
  data,
  tenantName,
  tenantNit,
  tenantAddress,
}: ReconciliationReportPdfProps) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.tenantName}>{tenantName}</Text>
            <Text style={s.tenantDetail}>NIT: {tenantNit}</Text>
            <Text style={s.tenantDetail}>{tenantAddress}</Text>
          </View>
          <View>
            <Text style={s.docTitle}>CONCILIACION BANCARIA</Text>
            <Text style={s.docSubtitle}>
              {data.bankName} - {fmtPeriod(data.period)}
            </Text>
          </View>
        </View>
        <View style={s.divider} />

        {/* Balance summary */}
        <View style={s.balanceRow}>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Saldo segun banco</Text>
            <Text style={s.balanceValue}>{fmtCOP(data.bankBalance)}</Text>
          </View>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Saldo segun libros</Text>
            <Text style={s.balanceValue}>{fmtCOP(data.bookBalance)}</Text>
          </View>
        </View>

        {/* In bank, not in books */}
        {data.inBankNotBooks.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>
              En banco, no en libros ({data.inBankNotBooks.length} partidas)
            </Text>
            <View style={s.table}>
              <View style={s.tableHeaderRow}>
                <Text style={[s.th, s.colDate]}>Fecha</Text>
                <Text style={[s.th, s.colDesc]}>Descripcion</Text>
                <Text style={[s.thRight, s.colAmount]}>Monto</Text>
              </View>
              {data.inBankNotBooks.map((line, i) => (
                <View
                  key={i}
                  style={
                    i === data.inBankNotBooks.length - 1
                      ? s.tableRowLast
                      : s.tableRow
                  }
                >
                  <Text style={[s.td, s.colDate]}>{fmtDate(line.date)}</Text>
                  <Text style={[s.td, s.colDesc]}>{line.description}</Text>
                  <Text style={[s.tdRight, s.colAmount]}>
                    {line.type === "credit" ? "+" : "-"}
                    {fmtCOP(line.amount)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* In books, not in bank */}
        {data.inBooksNotBank.length > 0 && (
          <View>
            <Text style={s.sectionTitle}>
              En libros, no en banco ({data.inBooksNotBank.length} partidas)
            </Text>
            <View style={s.table}>
              <View style={s.tableHeaderRow}>
                <Text style={[s.th, s.colDate]}>Fecha</Text>
                <Text style={[s.th, s.colDesc]}>Descripcion</Text>
                <Text style={[s.thRight, s.colAmount]}>Monto</Text>
              </View>
              {data.inBooksNotBank.map((line, i) => (
                <View
                  key={i}
                  style={
                    i === data.inBooksNotBank.length - 1
                      ? s.tableRowLast
                      : s.tableRow
                  }
                >
                  <Text style={[s.td, s.colDate]}>{fmtDate(line.date)}</Text>
                  <Text style={[s.td, s.colDesc]}>{line.description}</Text>
                  <Text style={[s.tdRight, s.colAmount]}>
                    {fmtCOP(line.amount)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Adjusted balances */}
        <View style={s.divider} />
        <View style={s.balanceRow}>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Saldo ajustado banco</Text>
            <Text style={s.balanceValue}>
              {fmtCOP(data.adjustedBankBalance)}
            </Text>
          </View>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Saldo ajustado libros</Text>
            <Text style={s.balanceValue}>
              {fmtCOP(data.adjustedBookBalance)}
            </Text>
          </View>
        </View>

        {/* Signatures */}
        <View style={s.sigRow}>
          <View style={s.sigBlock}>
            <View style={s.sigLine}>
              <Text style={s.sigLabel}>Firma Administrador</Text>
            </View>
          </View>
          <View style={s.sigBlock}>
            <View style={s.sigLine}>
              <Text style={s.sigLabel}>Firma Revisor Fiscal</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <View style={s.footerDivider} />
          <View style={s.footerRow}>
            <Text style={s.footerText}>
              Generado el: {fmtDate(new Date().toISOString().split("T")[0])}
            </Text>
            <Text style={s.footerText}>
              Total conciliados: {data.totalMatched} / {data.totalLines}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
