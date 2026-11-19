import "server-only";
import { eq, invoices, tenantSettings, type Tx } from "@rentevent/db";
import { invoiceTotals, lineNet, verifactuDate } from "./calc";
import { clientSnapshot, parseLines, type ClientSnapshot } from "./invoicing";

/**
 * Electronic invoicing / Verifactu provider. Real implementations (AEAT
 * Verifactu web service, FACe, a certified PAC) plug in here; the simulated
 * provider builds a Facturae 3.2.2-like XML and records the submission locally.
 */
export interface EInvoiceProvider {
  name: string;
  mode: "real" | "simulado";
  submit(input: { xml: string; invoiceId: string }): Promise<{ status: "aceptada" | "simulada" | "rechazada"; reference: string | null; message?: string }>;
}

export const simulatedProvider: EInvoiceProvider = {
  name: "Simulado",
  mode: "simulado",
  async submit({ invoiceId }) {
    return { status: "simulada", reference: `SIM-${invoiceId.slice(0, 8).toUpperCase()}` };
  },
};

export function getEInvoiceProvider(): EInvoiceProvider {
  return simulatedProvider;
}

const x = (s: string | number | null | undefined) =>
  String(s ?? "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

export async function buildFacturaeXml(tx: Tx, invoiceId: string): Promise<{ xml: string; fileName: string }> {
  const [inv] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!inv || !inv.fullNumber || !inv.issueDate) throw new Error("Factura no emitida");
  const [s] = await tx.select().from(tenantSettings);
  const client = (inv.clientSnapshot as ClientSnapshot | null) ?? (await clientSnapshot(tx, inv.clientId)) ?? { name: "", legalName: null, taxId: null, email: null, address: null };
  const lines = parseLines(inv.lines);
  const totals = invoiceTotals(lines);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<fe:Facturae xmlns:fe="http://www.facturae.gob.es/formato/Versiones/Facturaev3_2_2.xml">
  <FileHeader>
    <SchemaVersion>3.2.2</SchemaVersion>
    <Modality>I</Modality>
    <InvoiceIssuerType>EM</InvoiceIssuerType>
    <Batch><BatchIdentifier>${x(inv.fullNumber)}</BatchIdentifier><InvoicesCount>1</InvoicesCount>
      <TotalInvoicesAmount><TotalAmount>${totals.total.toFixed(2)}</TotalAmount></TotalInvoicesAmount>
      <InvoiceCurrencyCode>EUR</InvoiceCurrencyCode></Batch>
  </FileHeader>
  <Parties>
    <SellerParty><TaxIdentification><PersonTypeCode>J</PersonTypeCode><ResidenceTypeCode>R</ResidenceTypeCode><TaxIdentificationNumber>${x(s?.taxId)}</TaxIdentificationNumber></TaxIdentification>
      <LegalEntity><CorporateName>${x(s?.legalName)}</CorporateName><AddressInSpain><Address>${x(s?.address)}</Address><PostCode>${x(s?.postalCode)}</PostCode><Town>${x(s?.city)}</Town><Province>${x(s?.province)}</Province><CountryCode>ESP</CountryCode></AddressInSpain></LegalEntity></SellerParty>
    <BuyerParty><TaxIdentification><PersonTypeCode>J</PersonTypeCode><ResidenceTypeCode>R</ResidenceTypeCode><TaxIdentificationNumber>${x(client.taxId)}</TaxIdentificationNumber></TaxIdentification>
      <LegalEntity><CorporateName>${x(client.legalName ?? client.name)}</CorporateName><AddressInSpain><Address>${x(client.address)}</Address><CountryCode>ESP</CountryCode></AddressInSpain></LegalEntity></BuyerParty>
  </Parties>
  <Invoices><Invoice>
    <InvoiceHeader><InvoiceNumber>${x(inv.number)}</InvoiceNumber><InvoiceSeriesCode>${x(inv.fullNumber.split("-")[0])}</InvoiceSeriesCode><InvoiceDocumentType>FC</InvoiceDocumentType><InvoiceClass>${inv.kind === "rectificativa" ? "OR" : "OO"}</InvoiceClass>${
      inv.kind === "rectificativa" ? `<Corrective><ReasonCode>01</ReasonCode><ReasonDescription>${x(inv.rectificationReason)}</ReasonDescription><CorrectionMethod>01</CorrectionMethod></Corrective>` : ""
    }</InvoiceHeader>
    <InvoiceIssueData><IssueDate>${inv.issueDate}</IssueDate><InvoiceCurrencyCode>EUR</InvoiceCurrencyCode><TaxCurrencyCode>EUR</TaxCurrencyCode><LanguageName>es</LanguageName></InvoiceIssueData>
    <TaxesOutputs>${totals.breakdown
      .map((b) => `<Tax><TaxTypeCode>01</TaxTypeCode><TaxRate>${b.rate.toFixed(2)}</TaxRate><TaxableBase><TotalAmount>${b.base.toFixed(2)}</TotalAmount></TaxableBase><TaxAmount><TotalAmount>${b.amount.toFixed(2)}</TotalAmount></TaxAmount></Tax>`)
      .join("")}</TaxesOutputs>
    <InvoiceTotals><TotalGrossAmount>${totals.subtotal.toFixed(2)}</TotalGrossAmount><TotalGrossAmountBeforeTaxes>${totals.subtotal.toFixed(2)}</TotalGrossAmountBeforeTaxes><TotalTaxOutputs>${totals.vat.toFixed(2)}</TotalTaxOutputs><TotalTaxesWithheld>0.00</TotalTaxesWithheld><InvoiceTotal>${totals.total.toFixed(2)}</InvoiceTotal><TotalOutstandingAmount>${(totals.total - Number(inv.paid)).toFixed(2)}</TotalOutstandingAmount><TotalExecutableAmount>${totals.total.toFixed(2)}</TotalExecutableAmount></InvoiceTotals>
    <Items>${lines
      .map(
        (l) =>
          `<InvoiceLine><ItemDescription>${x(l.description)}</ItemDescription><Quantity>${l.quantity}</Quantity><UnitPriceWithoutTax>${l.unitPrice.toFixed(4)}</UnitPriceWithoutTax><TotalCost>${(l.quantity * l.unitPrice).toFixed(2)}</TotalCost><GrossAmount>${lineNet(l).toFixed(2)}</GrossAmount><TaxesOutputs><Tax><TaxTypeCode>01</TaxTypeCode><TaxRate>${l.taxRate.toFixed(2)}</TaxRate><TaxableBase><TotalAmount>${lineNet(l).toFixed(2)}</TotalAmount></TaxableBase></Tax></TaxesOutputs></InvoiceLine>`,
      )
      .join("")}</Items>
    <AdditionalData><InvoiceAdditionalInformation>Huella Verifactu ${x(inv.recordHash)} · fecha ${verifactuDate(inv.issueDate)}</InvoiceAdditionalInformation></AdditionalData>
  </Invoice></Invoices>
</fe:Facturae>
`;
  return { xml, fileName: `${inv.fullNumber}.xml` };
}

/** Submits the invoice through the configured provider and records the status. */
export async function submitEInvoice(tx: Tx, invoiceId: string) {
  const { xml } = await buildFacturaeXml(tx, invoiceId);
  const provider = getEInvoiceProvider();
  const res = await provider.submit({ xml, invoiceId });
  await tx.update(invoices).set({ verifactuStatus: res.status, einvoiceStatus: res.status }).where(eq(invoices.id, invoiceId));
  return res;
}

/** AEAT verification URL encoded in the invoice QR (Verifactu "ValidarQR" format). */
export function verifactuQrUrl(input: { taxId: string; fullNumber: string; issueDate: string; total: number }) {
  const p = new URLSearchParams({ nif: input.taxId, numserie: input.fullNumber, fecha: verifactuDate(input.issueDate), importe: input.total.toFixed(2) });
  return `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?${p.toString()}`;
}
