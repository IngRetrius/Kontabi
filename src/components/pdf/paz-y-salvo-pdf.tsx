import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";
import type { PazYSalvoData } from "@/lib/reports/certifications";

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

const c = {
  text: "#111827",
  muted: "#6b7280",
  border: "#d1d5db",
  borderLight: "#e5e7eb",
  success: "#059669",
  danger: "#dc2626",
  white: "#ffffff",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: c.text,
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 60,
  },
  header: {
    textAlign: "center",
    marginBottom: 20,
  },
  tenantName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    marginBottom: 4,
  },
  tenantDetail: {
    fontSize: 9,
    color: c.muted,
    marginBottom: 1,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    marginVertical: 16,
  },
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  body: {
    lineHeight: 1.6,
    fontSize: 11,
    marginBottom: 16,
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  infoLabel: {
    width: 120,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    color: c.muted,
  },
  infoValue: {
    flex: 1,
    fontSize: 10,
  },
  statusBox: {
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    marginVertical: 16,
    textAlign: "center",
  },
  statusText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 60,
    right: 60,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: c.text,
    width: 200,
    marginTop: 40,
    paddingTop: 4,
  },
  signatureLabel: {
    fontSize: 8,
    color: c.muted,
  },
  disclaimer: {
    fontSize: 7,
    color: c.muted,
    marginTop: 20,
    textAlign: "center",
  },
});

interface PazYSalvoPdfProps {
  data: PazYSalvoData;
}

export default function PazYSalvoPdf({ data }: PazYSalvoPdfProps) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.tenantName}>{data.tenantName}</Text>
          <Text style={s.tenantDetail}>NIT: {data.tenantNit}</Text>
          <Text style={s.tenantDetail}>{data.tenantAddress}</Text>
        </View>

        <View style={s.divider} />

        <Text style={s.title}>Certificado de Paz y Salvo</Text>

        {/* Unit info */}
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Unidad:</Text>
          <Text style={s.infoValue}>
            {data.unitNumber}
            {data.tower ? ` - Torre ${data.tower}` : ""}
          </Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Propietario:</Text>
          <Text style={s.infoValue}>{data.ownerName}</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Documento:</Text>
          <Text style={s.infoValue}>{data.ownerDocument}</Text>
        </View>
        <View style={s.infoRow}>
          <Text style={s.infoLabel}>Fecha certificado:</Text>
          <Text style={s.infoValue}>{fmtDate(data.certificationDate)}</Text>
        </View>
        {data.lastPaymentDate && (
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>Ultimo pago:</Text>
            <Text style={s.infoValue}>
              {fmtDate(data.lastPaymentDate)}
            </Text>
          </View>
        )}

        {/* Status */}
        <View
          style={[
            s.statusBox,
            {
              borderColor: data.isUpToDate ? c.success : c.danger,
              backgroundColor: data.isUpToDate ? "#f0fdf4" : "#fef2f2",
            },
          ]}
        >
          <Text
            style={[
              s.statusText,
              { color: data.isUpToDate ? c.success : c.danger },
            ]}
          >
            {data.isUpToDate
              ? "A PAZ Y SALVO"
              : `PENDIENTE: ${fmtCOP(data.pendingAmount)}`}
          </Text>
        </View>

        {/* Body text */}
        <Text style={s.body}>
          {data.isUpToDate
            ? `La administracion de ${data.tenantName} certifica que la unidad ${data.unitNumber}${data.tower ? ` de la Torre ${data.tower}` : ""}, propiedad de ${data.ownerName}, identificado(a) con ${data.ownerDocument}, se encuentra a paz y salvo con las obligaciones de administracion a la fecha de expedicion de este certificado.`
            : `La administracion de ${data.tenantName} certifica que la unidad ${data.unitNumber}${data.tower ? ` de la Torre ${data.tower}` : ""}, propiedad de ${data.ownerName}, identificado(a) con ${data.ownerDocument}, presenta un saldo pendiente de ${fmtCOP(data.pendingAmount)} a la fecha de expedicion de este certificado.`}
        </Text>

        {/* Signature */}
        <View style={s.footer}>
          <View style={s.signatureLine}>
            <Text style={s.signatureLabel}>
              Firma Administrador
            </Text>
          </View>
          <Text style={s.disclaimer}>
            Este certificado tiene validez unicamente en la fecha de su
            expedicion. Los valores corresponden a los registros del sistema
            contable del conjunto.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
