import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";
import type { UnitStatementResult } from "@/lib/accounting/account-statement";

// -- Helpers -----------------------------------------------------------------

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
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];
  const [year, month] = period.split("-");
  return `${months[Number(month) - 1]} ${year}`;
}

// -- Styles ------------------------------------------------------------------

const c = {
  text: "#111827",
  muted: "#6b7280",
  mutedLight: "#9ca3af",
  border: "#d1d5db",
  borderLight: "#e5e7eb",
  debt: "#dc2626",
  payment: "#059669",
  headerBg: "#f9fafb",
  altRow: "#f9fafb",
  white: "#ffffff",
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

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  tenantName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    marginBottom: 2,
  },
  tenantDetail: {
    fontSize: 8,
    color: c.muted,
    marginBottom: 1,
  },
  docTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: c.text,
    textAlign: "right",
  },
  docSubtitle: {
    fontSize: 8,
    color: c.muted,
    textAlign: "right",
    marginTop: 2,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    marginVertical: 10,
  },
  dividerThin: {
    borderBottomWidth: 0.5,
    borderBottomColor: c.borderLight,
    marginVertical: 8,
  },

  // Unit info
  unitInfoRow: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 4,
  },
  unitInfoItem: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: c.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },

  // Balance summary
  balanceRow: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 8,
  },
  balanceCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.borderLight,
    borderRadius: 4,
    padding: 8,
  },
  balanceLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: c.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  balanceValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },

  // Section title
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    marginTop: 4,
  },

  // Tables
  table: {
    borderWidth: 1,
    borderColor: c.borderLight,
    borderRadius: 2,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: c.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: c.borderLight,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: c.borderLight,
    backgroundColor: c.altRow,
  },
  tableRowLast: {
    flexDirection: "row",
  },
  th: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: c.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  td: {
    fontSize: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tdBold: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tdRight: {
    fontSize: 8,
    textAlign: "right",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tdRightBold: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  thRight: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: c.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    textAlign: "right",
    paddingVertical: 5,
    paddingHorizontal: 6,
  },

  // Column widths for movements table
  colDate: { width: "12%" },
  colPeriod: { width: "13%" },
  colConcept: { width: "31%" },
  colCharge: { width: "15%" },
  colPayment: { width: "15%" },
  colBalance: { width: "14%" },

  // Column widths for aging table
  colAgingRange: { width: "35%" },
  colAgingAmount: { width: "35%" },
  colAgingProvision: { width: "30%" },

  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
  },
  footerDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: c.borderLight,
    marginBottom: 6,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 7,
    color: c.mutedLight,
  },
  disclaimer: {
    fontSize: 6,
    color: c.mutedLight,
    marginTop: 4,
  },
});

// -- Props -------------------------------------------------------------------

interface AccountStatementPdfProps {
  data: UnitStatementResult;
  tenantName: string;
  tenantNit: string;
  tenantAddress: string;
  generatedDate: string;
  adminName: string;
}

// -- Component ---------------------------------------------------------------

export default function AccountStatementPdf({
  data,
  tenantName,
  tenantNit,
  tenantAddress,
  generatedDate,
  adminName,
}: AccountStatementPdfProps) {
  const balanceIsDebt = data.currentBalance > 0;
  const hasFavor = data.currentBalance < 0;
  const agingTotal = data.aging.reduce((sum, a) => sum + a.amount, 0);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* ---- Header ---- */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.tenantName}>{tenantName}</Text>
            <Text style={s.tenantDetail}>NIT: {tenantNit}</Text>
            <Text style={s.tenantDetail}>{tenantAddress}</Text>
          </View>
          <View>
            <Text style={s.docTitle}>ESTADO DE CUENTA</Text>
            <Text style={s.docSubtitle}>
              Unidad {data.unitNumber}
              {data.tower ? ` - Torre ${data.tower}` : ""}
            </Text>
          </View>
        </View>
        <View style={s.divider} />

        {/* ---- Unit info ---- */}
        <View style={s.unitInfoRow}>
          <View style={s.unitInfoItem}>
            <Text style={s.fieldLabel}>Unidad</Text>
            <Text style={s.fieldValue}>{data.unitNumber}</Text>
          </View>
          <View style={s.unitInfoItem}>
            <Text style={s.fieldLabel}>Torre</Text>
            <Text style={s.fieldValue}>{data.tower ?? "--"}</Text>
          </View>
          <View style={s.unitInfoItem}>
            <Text style={s.fieldLabel}>Propietario</Text>
            <Text style={s.fieldValue}>{data.ownerName ?? "--"}</Text>
          </View>
          <View style={s.unitInfoItem}>
            <Text style={s.fieldLabel}>Coeficiente</Text>
            <Text style={s.fieldValue}>
              {data.coefficient.toFixed(6)}
            </Text>
          </View>
        </View>
        <View style={s.dividerThin} />

        {/* ---- Balance summary ---- */}
        <View style={s.balanceRow}>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Total cobrado</Text>
            <Text style={s.balanceValue}>
              {fmtCOP(data.totalCharged)}
            </Text>
          </View>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>Total pagado</Text>
            <Text style={[s.balanceValue, { color: c.payment }]}>
              {fmtCOP(data.totalPaid)}
            </Text>
          </View>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>
              {balanceIsDebt
                ? "Saldo pendiente"
                : hasFavor
                  ? "Saldo a favor"
                  : "Saldo actual"}
            </Text>
            <Text
              style={[
                s.balanceValue,
                {
                  color: balanceIsDebt
                    ? c.debt
                    : hasFavor
                      ? c.payment
                      : c.text,
                },
              ]}
            >
              {fmtCOP(Math.abs(data.currentBalance))}
            </Text>
          </View>
        </View>

        {/* ---- Aging table ---- */}
        {agingTotal > 0 && (
          <View>
            <Text style={s.sectionTitle}>Antiguedad de cartera</Text>
            <View style={s.table}>
              <View style={s.tableHeaderRow}>
                <Text style={[s.th, s.colAgingRange]}>Rango</Text>
                <Text style={[s.thRight, s.colAgingAmount]}>Monto</Text>
                <Text style={[s.thRight, s.colAgingProvision]}>
                  Provision ({"%"})
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
                    <Text style={[s.td, s.colAgingRange]}>{a.label}</Text>
                    <Text style={[s.tdRight, s.colAgingAmount]}>
                      {fmtCOP(a.amount)}
                    </Text>
                    <Text style={[s.tdRight, s.colAgingProvision]}>
                      {fmtCOP(a.provision_amount)} ({a.provision_pct}%)
                    </Text>
                  </View>
                ))}
            </View>
            <View style={s.dividerThin} />
          </View>
        )}

        {/* ---- Movements table ---- */}
        <Text style={s.sectionTitle}>Detalle de movimientos</Text>
        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.th, s.colDate]}>Fecha</Text>
            <Text style={[s.th, s.colPeriod]}>Periodo</Text>
            <Text style={[s.th, s.colConcept]}>Concepto</Text>
            <Text style={[s.thRight, s.colCharge]}>Cargo</Text>
            <Text style={[s.thRight, s.colPayment]}>Abono</Text>
            <Text style={[s.thRight, s.colBalance]}>Saldo</Text>
          </View>
          {data.lines.map((line, i) => {
            const isLast = i === data.lines.length - 1;
            const rowStyle = isLast
              ? s.tableRowLast
              : i % 2 === 1
                ? s.tableRowAlt
                : s.tableRow;

            return (
              <View key={i} style={rowStyle}>
                <Text style={[s.td, s.colDate]}>
                  {fmtDate(line.date)}
                </Text>
                <Text style={[s.td, s.colPeriod]}>
                  {fmtPeriod(line.period)}
                </Text>
                <Text style={[s.td, s.colConcept]}>{line.concept}</Text>
                <Text style={[s.tdRight, s.colCharge]}>
                  {line.charge > 0 ? fmtCOP(line.charge) : "--"}
                </Text>
                <Text
                  style={[
                    s.tdRight,
                    s.colPayment,
                    line.payment > 0 ? { color: c.payment } : {},
                  ]}
                >
                  {line.payment > 0 ? fmtCOP(line.payment) : "--"}
                </Text>
                <Text
                  style={[
                    s.tdRightBold,
                    s.colBalance,
                    {
                      color:
                        line.balance > 0
                          ? c.debt
                          : line.balance < 0
                            ? c.payment
                            : c.text,
                    },
                  ]}
                >
                  {fmtCOP(Math.abs(line.balance))}
                  {line.balance < 0 ? " CF" : ""}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ---- Footer ---- */}
        <View style={s.footer} fixed>
          <View style={s.footerDivider} />
          <View style={s.footerRow}>
            <Text style={s.footerText}>
              Generado el: {generatedDate}
            </Text>
            <Text style={s.footerText}>
              Administrador: {adminName}
            </Text>
          </View>
          <Text style={s.disclaimer}>
            Este documento es informativo y no constituye titulo valor. Los
            valores presentados corresponden a los registros del sistema contable
            del conjunto. Para cualquier aclaracion, dirigirse a la
            administracion.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
