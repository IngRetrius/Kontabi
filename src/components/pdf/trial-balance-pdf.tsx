import { Document, Page, View, Text } from "@react-pdf/renderer";
import { PdfHeader } from "@/components/pdf/pdf-header";
import { PdfFooter } from "@/components/pdf/pdf-footer";
import { baseStyles, PDF_COLORS } from "@/lib/pdf/styles";
import { fmtCOP, fmtPeriod, fmtDate, today } from "@/lib/pdf/helpers";
import type { TrialBalanceData } from "@/lib/reports/trial-balance";
import type { TenantHeaderData } from "@/lib/reports/report-header";

interface TrialBalancePdfProps {
  data: TrialBalanceData;
  header: TenantHeaderData;
}

const s = baseStyles;

const col = {
  code: { width: "10%" },
  name: { width: "30%" },
  debit: { width: "15%" },
  credit: { width: "15%" },
  debitBal: { width: "15%" },
  creditBal: { width: "15%" },
};

export default function TrialBalancePdf({
  data,
  header,
}: TrialBalancePdfProps) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <PdfHeader
          tenantName={header.tenantName}
          tenantNit={header.tenantNit}
          tenantAddress={header.tenantAddress}
          reportHeaderText={header.reportHeaderText}
          logoUrl={header.logoUrl || undefined}
          docTitle="BALANCE DE COMPROBACION"
          docSubtitle={fmtPeriod(data.period)}
        />

        <View style={s.table}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.th, col.code]}>Codigo</Text>
            <Text style={[s.th, col.name]}>Cuenta</Text>
            <Text style={[s.thRight, col.debit]}>Debitos</Text>
            <Text style={[s.thRight, col.credit]}>Creditos</Text>
            <Text style={[s.thRight, col.debitBal]}>Saldo Db</Text>
            <Text style={[s.thRight, col.creditBal]}>Saldo Cr</Text>
          </View>
          {data.lines.map((line, i) => (
            <View
              key={line.accountCode}
              style={
                i === data.lines.length - 1
                  ? s.tableRowLast
                  : i % 2 === 1
                    ? s.tableRowAlt
                    : s.tableRow
              }
            >
              <Text style={[s.td, col.code]}>{line.accountCode}</Text>
              <Text style={[s.td, col.name]}>{line.accountName}</Text>
              <Text style={[s.tdRight, col.debit]}>
                {line.totalDebit > 0 ? fmtCOP(line.totalDebit) : "--"}
              </Text>
              <Text style={[s.tdRight, col.credit]}>
                {line.totalCredit > 0 ? fmtCOP(line.totalCredit) : "--"}
              </Text>
              <Text style={[s.tdRight, col.debitBal]}>
                {line.debitBalance > 0 ? fmtCOP(line.debitBalance) : "--"}
              </Text>
              <Text style={[s.tdRight, col.creditBal]}>
                {line.creditBalance > 0 ? fmtCOP(line.creditBalance) : "--"}
              </Text>
            </View>
          ))}
          <View style={s.totalRow}>
            <Text style={[s.tdBold, col.code]} />
            <Text style={[s.tdBold, col.name]}>TOTALES</Text>
            <Text style={[s.tdRightBold, col.debit]}>
              {fmtCOP(data.totalDebit)}
            </Text>
            <Text style={[s.tdRightBold, col.credit]}>
              {fmtCOP(data.totalCredit)}
            </Text>
            <Text style={[s.tdRightBold, col.debitBal]}>
              {fmtCOP(data.totalDebitBalance)}
            </Text>
            <Text style={[s.tdRightBold, col.creditBal]}>
              {fmtCOP(data.totalCreditBalance)}
            </Text>
          </View>
        </View>

        <Text
          style={[
            s.note,
            data.isBalanced
              ? { color: PDF_COLORS.payment }
              : { color: PDF_COLORS.debt },
          ]}
        >
          {data.isBalanced
            ? "Cuadratura verificada: debitos = creditos."
            : "ATENCION: Los totales no cuadran. Revisar asientos contables."}
        </Text>

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
