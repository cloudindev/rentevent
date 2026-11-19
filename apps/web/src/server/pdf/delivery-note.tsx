import "server-only";
/* eslint-disable jsx-a11y/alt-text -- @react-pdf Image elements have no alt attribute */
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { contacts, deliveryNotes, eq, orders, projects, tenantSettings, venues, type Tx } from "@rentevent/db";
import { getObject } from "@/lib/adapters/storage";

const num = (n: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2, useGrouping: "always" }).format(n);
const dt = (d: Date | null | undefined) => (d ? new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d) : "—");

export const pdfStyles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica", color: "#111" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  row: { flexDirection: "row" },
  muted: { color: "#6b6b68" },
  h1: { fontSize: 18, fontFamily: "Helvetica-Bold" },
  label: { fontSize: 7, color: "#6b6b68", textTransform: "uppercase", marginBottom: 3 },
  box: { borderWidth: 1, borderColor: "#e7e7e4", borderRadius: 6, padding: 10 },
  th: { fontSize: 7, color: "#6b6b68", textTransform: "uppercase", paddingVertical: 6 },
  td: { paddingVertical: 5 },
  line: { borderBottomWidth: 1, borderBottomColor: "#eeeeec" },
  accent: { color: "#c0311f" },
  bold: { fontFamily: "Helvetica-Bold" },
});
const s = pdfStyles;

/** Tenant logo as a data URL when it is a storage key (or an absolute URL), else null. */
export async function tenantLogo(logoUrl: string | null | undefined): Promise<string | null> {
  if (!logoUrl) return null;
  if (logoUrl.startsWith("data:") || /^https?:\/\//.test(logoUrl)) return logoUrl;
  const key = logoUrl.startsWith("/api/files/") ? decodeURIComponent(logoUrl.slice("/api/files/".length)) : logoUrl;
  const obj = await getObject(key);
  return obj && /png|jpe?g/.test(obj.contentType) ? `data:${obj.contentType};base64,${obj.body.toString("base64")}` : null;
}

type NoteLine = { name: string; sku: string; unit: string; quantity: number; damaged?: number; serials?: string[] };

export async function renderDeliveryNotePdf(tx: Tx, id: string, tenantName: string): Promise<{ buffer: Buffer; fileName: string } | null> {
  const [n] = await tx.select().from(deliveryNotes).where(eq(deliveryNotes.id, id));
  if (!n) return null;
  const [o] = await tx.select().from(orders).where(eq(orders.id, n.orderId));
  const [p] = o ? await tx.select().from(projects).where(eq(projects.id, o.projectId)) : [undefined];
  const [v] = p?.venueId ? await tx.select().from(venues).where(eq(venues.id, p.venueId)) : [undefined];
  const [c] = o?.clientId ? await tx.select().from(contacts).where(eq(contacts.id, o.clientId)) : [undefined];
  const [st] = await tx.select().from(tenantSettings);
  const logo = await tenantLogo(st?.logoUrl);
  const lines = (n.lines as NoteLine[]) ?? [];
  const isOut = n.kind === "entrega";
  const doc = (
    <Document title={n.number} author={st?.legalName || tenantName}>
      <Page size="A4" style={s.page}>
        <View style={[s.between, { marginBottom: 22 }]}>
          <View>
            {logo ? <Image src={logo} style={{ height: 34, objectFit: "contain", marginBottom: 8 }} /> : <Text style={[s.bold, { fontSize: 14, marginBottom: 8 }]}>{tenantName}</Text>}
            <Text style={s.bold}>{st?.legalName || tenantName}</Text>
            <Text style={s.muted}>NIF {st?.taxId || "—"}</Text>
            <Text style={s.muted}>{[st?.address, st?.city].filter(Boolean).join(", ")}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.h1}>Albarán de {isOut ? "entrega" : "recogida"}</Text>
            <Text style={[s.accent, { fontSize: 11, marginTop: 4 }]}>{n.number}</Text>
            <Text style={[s.muted, { marginTop: 6 }]}>Fecha: {dt(n.createdAt)}</Text>
            <Text style={s.muted}>Pedido: {o?.number ?? "—"}</Text>
          </View>
        </View>
        <View style={[s.row, { gap: 12, marginBottom: 18 }]}>
          <View style={[s.box, { flex: 1 }]}>
            <Text style={s.label}>Cliente</Text>
            <Text style={s.bold}>{c?.legalName || c?.name || "—"}</Text>
            {c?.taxId ? <Text style={s.muted}>NIF {c.taxId}</Text> : null}
          </View>
          <View style={[s.box, { flex: 1 }]}>
            <Text style={s.label}>Evento y lugar</Text>
            <Text style={s.bold}>{o?.title ?? "—"}</Text>
            <Text style={s.muted}>{v?.name ?? p?.locationAddress ?? "—"}</Text>
          </View>
        </View>
        <View style={[s.row, s.line]}>
          <Text style={[s.th, { flex: 4 }]}>Artículo</Text>
          <Text style={[s.th, { flex: 1.5 }]}>Código</Text>
          <Text style={[s.th, { flex: 1, textAlign: "right" }]}>Cantidad</Text>
          {!isOut && <Text style={[s.th, { flex: 1, textAlign: "right" }]}>Daños</Text>}
        </View>
        {lines.map((l, i) => (
          <View key={i} style={[s.row, s.line]} wrap={false}>
            <View style={[s.td, { flex: 4 }]}>
              <Text>{l.name}</Text>
              {l.serials && l.serials.length > 0 ? <Text style={[s.muted, { fontSize: 7 }]}>{l.serials.join(", ")}</Text> : null}
            </View>
            <Text style={[s.td, { flex: 1.5 }]}>{l.sku}</Text>
            <Text style={[s.td, { flex: 1, textAlign: "right" }]}>{num(l.quantity)}{l.unit === "m2" ? " m²" : ""}</Text>
            {!isOut && <Text style={[s.td, { flex: 1, textAlign: "right" }]}>{l.damaged ? num(l.damaged) : "—"}</Text>}
          </View>
        ))}
        <Text style={[s.muted, { marginTop: 14 }]}>
          {isOut ? "El cliente declara recibir el material indicado en buen estado y se responsabiliza de su custodia hasta la recogida." : "Material recogido según recuento en el lugar del evento. Los daños indicados quedan pendientes de valoración."}
        </Text>
        <View style={[s.row, { gap: 24, marginTop: 30 }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Firma del cliente</Text>
            {n.signature ? <Image src={n.signature} style={{ height: 70, objectFit: "contain" }} /> : <View style={{ height: 70, borderBottomWidth: 1, borderBottomColor: "#999" }} />}
            <Text style={s.muted}>{n.signedName ? `${n.signedName} · ${dt(n.signedAt)}` : "Nombre y fecha"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Por {st?.legalName || tenantName}</Text>
            <View style={{ height: 70, borderBottomWidth: 1, borderBottomColor: "#999" }} />
            <Text style={s.muted}>Responsable de montaje</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
  return { buffer: await renderToBuffer(doc), fileName: `${n.number}.pdf` };
}
