import { View, Text, StyleSheet, Image } from "@react-pdf/renderer";
import { PDF_COLORS } from "@/lib/pdf/styles";

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  left: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
  },
  logo: {
    width: 48,
    height: 48,
  },
  tenantName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    marginBottom: 2,
  },
  tenantDetail: {
    fontSize: 8,
    color: PDF_COLORS.muted,
    marginBottom: 1,
  },
  headerText: {
    fontSize: 7,
    color: PDF_COLORS.muted,
    marginTop: 2,
  },
  right: {
    alignItems: "flex-end",
  },
  docTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: PDF_COLORS.text,
    textAlign: "right",
  },
  docSubtitle: {
    fontSize: 8,
    color: PDF_COLORS.muted,
    textAlign: "right",
    marginTop: 2,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
    marginVertical: 10,
  },
});

interface PdfHeaderProps {
  tenantName: string;
  tenantNit: string;
  tenantAddress: string;
  reportHeaderText?: string;
  logoUrl?: string;
  docTitle: string;
  docSubtitle?: string;
}

export function PdfHeader({
  tenantName,
  tenantNit,
  tenantAddress,
  reportHeaderText,
  logoUrl,
  docTitle,
  docSubtitle,
}: PdfHeaderProps) {
  return (
    <>
      <View style={s.row}>
        <View style={s.left}>
          {logoUrl ? <Image style={s.logo} src={logoUrl} /> : null}
          <View>
            <Text style={s.tenantName}>{tenantName}</Text>
            <Text style={s.tenantDetail}>NIT: {tenantNit}</Text>
            <Text style={s.tenantDetail}>{tenantAddress}</Text>
            {reportHeaderText ? (
              <Text style={s.headerText}>{reportHeaderText}</Text>
            ) : null}
          </View>
        </View>
        <View style={s.right}>
          <Text style={s.docTitle}>{docTitle}</Text>
          {docSubtitle ? (
            <Text style={s.docSubtitle}>{docSubtitle}</Text>
          ) : null}
        </View>
      </View>
      <View style={s.divider} />
    </>
  );
}
