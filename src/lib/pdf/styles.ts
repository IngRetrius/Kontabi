import { StyleSheet } from "@react-pdf/renderer";

export const PDF_COLORS = {
  text: "#111827",
  muted: "#6b7280",
  mutedLight: "#9ca3af",
  border: "#d1d5db",
  borderLight: "#e5e7eb",
  debt: "#dc2626",
  payment: "#059669",
  warning: "#d97706",
  headerBg: "#f9fafb",
  altRow: "#f9fafb",
  white: "#ffffff",
};

export const baseStyles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: PDF_COLORS.text,
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
  },

  // Dividers
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.border,
    marginVertical: 10,
  },
  dividerThin: {
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.borderLight,
    marginVertical: 8,
  },

  // Section
  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 6,
    marginTop: 4,
  },

  // Balance cards
  balanceRow: {
    flexDirection: "row",
    gap: 12,
    marginVertical: 8,
  },
  balanceCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: PDF_COLORS.borderLight,
    borderRadius: 4,
    padding: 8,
  },
  balanceLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  balanceValue: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },

  // Tables
  table: {
    borderWidth: 1,
    borderColor: PDF_COLORS.borderLight,
    borderRadius: 2,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: PDF_COLORS.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.borderLight,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.borderLight,
  },
  tableRowAlt: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.borderLight,
    backgroundColor: PDF_COLORS.altRow,
  },
  tableRowLast: {
    flexDirection: "row",
  },
  totalRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.border,
    backgroundColor: PDF_COLORS.headerBg,
  },
  th: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  thRight: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: PDF_COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    textAlign: "right",
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

  // Note text
  note: {
    fontSize: 7,
    color: PDF_COLORS.muted,
    marginTop: 6,
    fontStyle: "italic",
  },
});
