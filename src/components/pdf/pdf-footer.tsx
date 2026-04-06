import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { PDF_COLORS } from "@/lib/pdf/styles";

const s = StyleSheet.create({
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
  },
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.borderLight,
    marginBottom: 6,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  text: {
    fontSize: 7,
    color: PDF_COLORS.mutedLight,
  },
  disclaimer: {
    fontSize: 6,
    color: PDF_COLORS.mutedLight,
    marginTop: 4,
  },
});

const DEFAULT_DISCLAIMER =
  "Este documento es informativo y no constituye titulo valor. Los valores presentados corresponden a los registros del sistema contable. Para cualquier aclaracion, dirigirse a la administracion.";

interface PdfFooterProps {
  generatedDate: string;
  adminName?: string;
  disclaimer?: string;
}

export function PdfFooter({
  generatedDate,
  adminName,
  disclaimer,
}: PdfFooterProps) {
  return (
    <View style={s.footer} fixed>
      <View style={s.divider} />
      <View style={s.row}>
        <Text style={s.text}>Generado el: {generatedDate}</Text>
        {adminName ? (
          <Text style={s.text}>Administrador: {adminName}</Text>
        ) : null}
      </View>
      <Text style={s.disclaimer}>{disclaimer ?? DEFAULT_DISCLAIMER}</Text>
    </View>
  );
}
