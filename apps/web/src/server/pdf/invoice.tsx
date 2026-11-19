import "server-only";
/* eslint-disable jsx-a11y/alt-text -- @react-pdf Image elements have no alt attribute */
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { eq, invoices, tenantSettings, type Tx } from "@rentevent/db";
import { getObject } from "@/lib/adapters/storage";
import { invoiceTotals, lineNet, type InvoiceLine } from "../finance/calc";
import { INVOICE_KIND_LABELS, clientSnapshot, parseLines, type ClientSnapshot } from "../finance/invoicing";
import { verifactuQrUrl } from "../finance/einvoice";

const eur = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n);
const num = (n: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(n);
const date = (iso: string | null) => (iso ? new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)) : "—");

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica", color: "#111" },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  muted: { color: "#6b6b68" },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  label: { fontSize: 7, color: "#6b6b68", textTransform: "uppercase", marginBottom: 3 },
  box: { borderWidth: 1, borderColor: "#e7e7e4", borderRadius: 6, padding: 10 },
  th: { fontSize: 7, color: "#6b6b68", textTransform: "uppercase", paddingVertical: 6 },
  td: { paddingVertical: 6 },
  line: { borderBottomWidth: 1, borderBottomColor: "#eeeeec" },
  accent: { color: "#c0311f" },
});

export type InvoicePdfData = {
  inv: typeof invoices.$inferSelect;
  settings: typeof tenantSettings.$inferSelect | null;
  tenantName: string;
  logo: string | null;
  qr: string | null;
  lines: InvoiceLine[];
};

function InvoiceDoc({ d }: { d: InvoicePdfData }) {
  const { inv, settings } = d;
  const client = (inv.clientSnapshot as ClientSnapshot | null) ?? null;
  const t = invoiceTotals(d.lines);
  const title = inv.kind === "rectificativa" ? "Factura rectificativa" : inv.kind === "anticipo" ? "Factura de anticipo" : "Factura";
  return (
    <Document title={inv.fullNumber ?? "Borrador"} author={settings?.legalName ?? d.tenantName}>
      <Page size="A4" style={s.page}>
        <View style={[s.between, { marginBottom: 24 }]}>
          <View>
            {d.logo ? <Image src={d.logo} style={{ height: 36, objectFit: "contain", marginBottom: 8 }} /> : <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 8 }}>{d.tenantName}</Text>}
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{settings?.legalName || d.tenantName}</Text>
            <Text style={s.muted}>NIF {settings?.taxId || "—"}</Text>
            <Text style={s.muted}>{[settings?.address, [settings?.postalCode, settings?.city].filter(Boolean).join(" "), settings?.province].filter(Boolean).join(", ")}</Text>
            <Text style={s.muted}>{[settings?.phone, settings?.email].filter(Boolean).join(" · ")}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.h1}>{title}</Text>
            <Text style={[s.accent, { fontSize: 11, marginTop: 4 }]}>{inv.fullNumber ?? "BORRADOR"}</Text>
            <Text style={[s.muted, { marginTop: 6 }]}>Fecha: {date(inv.issueDate)}</Text>
            <Text style={s.muted}>Vencimiento: {date(inv.dueDate)}</Text>
          </View>
        </View>

        <View style={[s.row, { gap: 12, marginBottom: 18 }]}>
          <View style={[s.box, { flex: 1 }]}>
            <Text style={s.label}>Cliente</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{client?.legalName || client?.name || "—"}</Text>
            {client?.taxId ? <Text>NIF {client.taxId}</Text> : null}
            {client?.address ? <Text style={s.muted}>{client.address}</Text> : null}
            {client?.email ? <Text style={s.muted}>{client.email}</Text> : null}
          </View>
          {inv.kind === "rectificativa" && inv.rectificationReason ? (
            <View style={[s.box, { flex: 1 }]}>
              <Text style={s.label}>Rectificación</Text>
              <Text>{inv.notes}</Text>
            </View>
          ) : null}
        </View>

        <View style={[s.row, s.line]}>
          <Text style={[s.th, { flex: 5 }]}>Concepto</Text>
          <Text style={[s.th, { flex: 1, textAlign: "right" }]}>Cant.</Text>
          <Text style={[s.th, { flex: 1.5, textAlign: "right" }]}>Precio</Text>
          <Text style={[s.th, { flex: 1, textAlign: "right" }]}>Dto.</Text>
          <Text style={[s.th, { flex: 1, textAlign: "right" }]}>IVA</Text>
          <Text style={[s.th, { flex: 1.6, textAlign: "right" }]}>Importe</Text>
        </View>
        {d.lines.map((l, i) => (
          <View key={i} style={[s.row, s.line]} wrap={false}>
            <Text style={[s.td, { flex: 5, paddingRight: 6 }]}>{l.description}</Text>
            <Text style={[s.td, { flex: 1, textAlign: "right" }]}>{num(l.quantity)}</Text>
            <Text style={[s.td, { flex: 1.5, textAlign: "right" }]}>{eur(l.unitPrice)}</Text>
            <Text style={[s.td, { flex: 1, textAlign: "right" }]}>{l.discountPct ? `${num(l.discountPct)} %` : ""}</Text>
            <Text style={[s.td, { flex: 1, textAlign: "right" }]}>{l.taxRate} %</Text>
            <Text style={[s.td, { flex: 1.6, textAlign: "right" }]}>{eur(lineNet(l))}</Text>
          </View>
        ))}

        <View style={[s.between, { marginTop: 18 }]} wrap={false}>
          <View style={{ width: 220 }}>
            {d.qr ? (
              <View style={[s.row, { gap: 8, alignItems: "center" }]}>
                <Image src={d.qr} style={{ width: 70, height: 70 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>VERI*FACTU</Text>
                  <Text style={[s.muted, { fontSize: 7 }]}>Factura verificable en la sede electrónica de la AEAT</Text>
                  <Text style={[s.muted, { fontSize: 6, marginTop: 3 }]}>Huella: {inv.recordHash?.slice(0, 32)}…</Text>
                </View>
              </View>
            ) : null}
          </View>
          <View style={{ width: 220 }}>
            <View style={[s.between, { paddingVertical: 3 }]}>
              <Text style={s.muted}>Base imponible</Text>
              <Text>{eur(t.subtotal)}</Text>
            </View>
            {t.breakdown.map((b) => (
              <View key={b.rate} style={[s.between, { paddingVertical: 3 }]}>
                <Text style={s.muted}>
                  IVA {b.rate} % sobre {eur(b.base)}
                </Text>
                <Text>{eur(b.amount)}</Text>
              </View>
            ))}
            <View style={[s.between, { borderTopWidth: 1, borderTopColor: "#111", marginTop: 4, paddingTop: 6 }]}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11 }}>Total</Text>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11 }}>{eur(t.total)}</Text>
            </View>
            {Number(inv.paid) > 0 ? (
              <View style={[s.between, { paddingVertical: 3 }]}>
                <Text style={s.muted}>Cobrado</Text>
                <Text>{eur(Number(inv.paid))}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ marginTop: 24 }} wrap={false}>
          {settings?.iban ? (
            <Text>
              Forma de pago: transferencia a <Text style={{ fontFamily: "Helvetica-Bold" }}>{settings.iban}</Text>
              {inv.fullNumber ? ` indicando ${inv.fullNumber}` : ""}.
            </Text>
          ) : null}
          {inv.notes && inv.kind !== "rectificativa" ? <Text style={[s.muted, { marginTop: 6 }]}>{inv.notes}</Text> : null}
        </View>

        <Text style={{ position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7, color: "#9a9a96", textAlign: "center" }} fixed>
          {settings?.legalName || d.tenantName} · NIF {settings?.taxId || "—"} · {INVOICE_KIND_LABELS[inv.kind] ?? "Factura"} {inv.fullNumber ?? "borrador"}
        </Text>
      </Page>
    </Document>
  );
}

async function logoDataUrl(logoUrl: string | null | undefined): Promise<string | null> {
  if (!logoUrl) return null;
  if (logoUrl.startsWith("data:")) return logoUrl;
  const key = logoUrl.startsWith("/api/files/") ? decodeURIComponent(logoUrl.slice("/api/files/".length)) : logoUrl.startsWith("http") ? null : logoUrl;
  if (!key) return null;
  const obj = await getObject(key).catch(() => null);
  if (!obj || !/^image\/(png|jpe?g)$/.test(obj.contentType)) return null;
  return `data:${obj.contentType};base64,${obj.body.toString("base64")}`;
}

export async function renderInvoicePdf(tx: Tx, invoiceId: string, tenantName: string): Promise<{ buffer: Buffer; fileName: string } | null> {
  const [row] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId));
  if (!row) return null;
  const inv = row.clientSnapshot ? row : { ...row, clientSnapshot: await clientSnapshot(tx, row.clientId) };
  const [settings] = await tx.select().from(tenantSettings);
  const lines = parseLines(inv.lines);
  const qr =
    inv.fullNumber && inv.issueDate
      ? await QRCode.toDataURL(verifactuQrUrl({ taxId: settings?.taxId ?? "", fullNumber: inv.fullNumber, issueDate: inv.issueDate, total: Number(inv.total) }), { margin: 0, width: 240 })
      : null;
  const buffer = await renderToBuffer(<InvoiceDoc d={{ inv, settings: settings ?? null, tenantName, logo: await logoDataUrl(settings?.logoUrl), qr, lines }} />);
  return { buffer, fileName: `${inv.fullNumber ?? `borrador-${inv.id.slice(0, 8)}`}.pdf` };
}
