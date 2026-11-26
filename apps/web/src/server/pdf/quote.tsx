import "server-only";
/* eslint-disable jsx-a11y/alt-text -- @react-pdf Image elements have no alt attribute */
import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { termsBlocks } from "@/lib/terms";
import { contacts, eq, orders, projects, quotes, tenantSettings, venues, type Tx } from "@rentevent/db";
import { compositionSchema, PRICE_MODE_LABELS, type Composition, type PriceMode, type QuoteTotals } from "@rentevent/core";
import { getObject } from "@/lib/adapters/storage";
import { env } from "@/lib/env";
import { planToSvgString } from "@/components/tent3d/plan-svg";
import { loadCatalog } from "../catalog";

const eur = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", useGrouping: "always" }).format(n);
const num = (n: number) => new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2, useGrouping: "always" }).format(n);
const dt = (d: string | Date | null | undefined) =>
  d ? new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d)) : "—";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica", color: "#111" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  muted: { color: "#6b6b68" },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  label: { fontSize: 7, color: "#6b6b68", textTransform: "uppercase", marginBottom: 3 },
  box: { borderWidth: 1, borderColor: "#e7e7e4", borderRadius: 6, padding: 10 },
  th: { fontSize: 7, color: "#6b6b68", textTransform: "uppercase", paddingVertical: 6 },
  td: { paddingVertical: 5 },
  line: { borderBottomWidth: 1, borderBottomColor: "#eeeeec", flexDirection: "row" },
  accent: { color: "#c0311f" },
});

type Snapshot = {
  rows: { description: string; quantity: number; unitPrice: number; priceMode: string; discountPct: number; kind: string; taxRate: number }[];
  totals: QuoteTotals;
  tents: { label: string; composition: Composition; bom?: { name: string; quantity: number; unit: string }[]; metrics?: { superficie: number; weightKg: number; montajeHoras: number } }[];
  terms: string;
  days: number;
  imageKey: string | null;
  title: string;
  eventStart: string | null;
  eventEnd: string | null;
  periodStart: string;
  periodEnd: string;
};

export type QuotePdfInput = {
  number: string;
  version: number;
  validUntil: string | null;
  snap: Snapshot;
  tenant: { name: string; legalName: string; taxId: string; address: string; phone: string; email: string; logo: string | null };
  /** full-page cover image (data url), printed before everything else */
  cover: { src: string; fit: "width" | "height" } | null;
  client: { name: string; taxId: string | null; email: string | null } | null;
  venue: string | null;
  image: string | null;
  plan: string | null;
  qr: string | null;
  url: string;
  signature: { name: string | null; image: string | null; at: Date | null } | null;
};

function QuoteDoc({ d }: { d: QuotePdfInput }) {
  const t = d.snap.totals;
  return (
    <Document title={`Presupuesto ${d.number}`} author={d.tenant.legalName || d.tenant.name}>
      {d.cover ? (
        <Page size="A4" style={{ padding: 0, backgroundColor: "#ffffff" }}>
          {d.cover.fit === "width" ? (
            <Image src={d.cover.src} style={{ width: "100%" }} />
          ) : (
            <Image src={d.cover.src} style={{ height: "100%", alignSelf: "center" }} />
          )}
        </Page>
      ) : null}
      <Page size="A4" style={s.page}>
        <View style={[s.between, { marginBottom: 22 }]}>
          <View>
            {d.tenant.logo ? <Image src={d.tenant.logo} style={{ height: 36, objectFit: "contain", marginBottom: 8 }} /> : <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 8 }}>{d.tenant.name}</Text>}
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{d.tenant.legalName || d.tenant.name}</Text>
            {d.tenant.taxId ? <Text style={s.muted}>NIF {d.tenant.taxId}</Text> : null}
            <Text style={s.muted}>{d.tenant.address}</Text>
            <Text style={s.muted}>{[d.tenant.phone, d.tenant.email].filter(Boolean).join(" · ")}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.h1}>Presupuesto</Text>
            <Text style={[s.accent, { fontSize: 11, marginTop: 4 }]}>{d.number} · versión {d.version}</Text>
            {d.validUntil ? <Text style={[s.muted, { marginTop: 6 }]}>Válido hasta {new Date(`${d.validUntil}T12:00:00Z`).toLocaleDateString("es-ES")}</Text> : null}
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
          <View style={[s.box, { flex: 1 }]}>
            <Text style={s.label}>Cliente</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{d.client?.name ?? "—"}</Text>
            {d.client?.taxId ? <Text style={s.muted}>NIF {d.client.taxId}</Text> : null}
            {d.client?.email ? <Text style={s.muted}>{d.client.email}</Text> : null}
          </View>
          <View style={[s.box, { flex: 1.3 }]}>
            <Text style={s.label}>Evento</Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{d.snap.title}</Text>
            {d.venue ? <Text style={s.muted}>{d.venue}</Text> : null}
            <Text style={s.muted}>Evento: {dt(d.snap.eventStart)} – {dt(d.snap.eventEnd)}</Text>
            <Text style={s.muted}>Montaje desde {dt(d.snap.periodStart)} · retirada hasta {dt(d.snap.periodEnd)}</Text>
          </View>
        </View>

        {d.image ? (
          <View style={{ marginBottom: 14 }}>
            <Image src={d.image} style={{ width: "100%", maxHeight: 250, objectFit: "contain", borderRadius: 6 }} />
          </View>
        ) : null}

        <View style={[s.line, { borderBottomColor: "#d6d6d2" }]}>
          <Text style={[s.th, { flex: 5 }]}>Concepto</Text>
          <Text style={[s.th, { flex: 1.2, textAlign: "right" }]}>Cantidad</Text>
          <Text style={[s.th, { flex: 1.6, textAlign: "right" }]}>Precio</Text>
          <Text style={[s.th, { flex: 0.9, textAlign: "right" }]}>Dto.</Text>
          <Text style={[s.th, { flex: 1.6, textAlign: "right" }]}>Importe</Text>
        </View>
        {d.snap.rows.map((r, i) => {
          const gross = r.quantity * r.unitPrice;
          return (
            <View key={i} style={s.line} wrap={false}>
              <Text style={[s.td, { flex: 5, fontFamily: r.kind === "carpa" ? "Helvetica-Bold" : "Helvetica", paddingLeft: r.kind === "suplemento" ? 10 : 0 }]}>{r.description}</Text>
              <Text style={[s.td, { flex: 1.2, textAlign: "right" }]}>
                {num(r.quantity)} {r.priceMode === "m2" ? "m²" : r.priceMode === "ml" ? "m" : r.priceMode === "hora" ? "h" : ""}
              </Text>
              <Text style={[s.td, { flex: 1.6, textAlign: "right" }]}>
                {eur(r.unitPrice)} <Text style={s.muted}>{PRICE_MODE_LABELS[r.priceMode as PriceMode] === "por unidad" ? "" : ""}</Text>
              </Text>
              <Text style={[s.td, { flex: 0.9, textAlign: "right" }]}>{r.discountPct ? `${num(r.discountPct)} %` : ""}</Text>
              <Text style={[s.td, { flex: 1.6, textAlign: "right" }]}>{eur(gross * (1 - r.discountPct / 100))}</Text>
            </View>
          );
        })}
        <Text style={[s.muted, { marginTop: 4, fontSize: 7.5 }]}>
          Importes por {d.snap.days} día{d.snap.days > 1 ? "s" : ""} de evento; los artículos por día llevan aplicado el escalado por duración en el total.
        </Text>

        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 12 }} wrap={false}>
          <View style={{ width: 230 }}>
            <View style={s.between}><Text style={s.muted}>Subtotal</Text><Text>{eur(t.gross)}</Text></View>
            {t.lineDiscounts ? <View style={s.between}><Text style={s.muted}>Descuentos</Text><Text>− {eur(t.lineDiscounts)}</Text></View> : null}
            {t.globalDiscount ? <View style={s.between}><Text style={s.muted}>Descuento cliente</Text><Text>− {eur(t.globalDiscount)}</Text></View> : null}
            <View style={s.between}><Text style={s.muted}>Base imponible</Text><Text>{eur(t.taxable)}</Text></View>
            {t.vatBreakdown.map((v) => (
              <View key={v.rate} style={s.between}><Text style={s.muted}>IVA {v.rate} %</Text><Text>{eur(v.amount)}</Text></View>
            ))}
            <View style={[s.between, { borderTopWidth: 1, borderTopColor: "#111", marginTop: 4, paddingTop: 4 }]}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12 }}>Total</Text>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12 }}>{eur(t.total)}</Text>
            </View>
          </View>
        </View>
      </Page>

      {d.snap.tents.length > 0 ? (
        <Page size="A4" style={s.page}>
          <Text style={s.h2}>Plano acotado</Text>
          {d.plan ? <Image src={d.plan} style={{ width: "100%", maxHeight: 330, objectFit: "contain", marginBottom: 14 }} /> : <Text style={s.muted}>Plano no disponible.</Text>}
          {d.snap.tents.map((tent, i) => (
            <View key={i} style={{ marginBottom: 12 }} wrap={false}>
              <Text style={s.h2}>{tent.label}</Text>
              {tent.metrics ? (
                <Text style={[s.muted, { marginBottom: 6 }]}>
                  {num(tent.metrics.superficie)} m² cubiertos · {num(tent.metrics.weightKg / 1000)} t de material · {num(tent.metrics.montajeHoras)} h·persona de montaje
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {(tent.bom ?? []).map((b, j) => (
                  <Text key={j} style={{ width: "50%", paddingVertical: 2 }}>
                    {num(b.quantity)} {b.unit === "m2" ? "m²" : "×"} {b.name}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </Page>
      ) : null}

      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Condiciones</Text>
        <View style={{ marginBottom: 20 }}>
          {termsBlocks(d.snap.terms || "Precios sin IVA.").map((t, i) =>
            t.kind === "title" ? (
              <Text key={i} style={{ fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 6 }}>{t.text}</Text>
            ) : t.kind === "heading" ? (
              <Text key={i} style={{ fontFamily: "Helvetica-Bold", marginTop: i ? 7 : 0, marginBottom: 2 }} minPresenceAhead={24}>{t.text}</Text>
            ) : (
              <Text key={i} style={{ lineHeight: 1.35, fontSize: 8.5, marginBottom: 1 }}>{t.text}</Text>
            ),
          )}
        </View>
        <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}>
          <View style={[s.box, { flex: 1, minHeight: 110 }]}>
            <Text style={s.label}>Aceptación del cliente</Text>
            {d.signature?.image ? <Image src={d.signature.image} style={{ height: 60, objectFit: "contain" }} /> : null}
            <Text>{d.signature?.name ?? "Nombre y firma:"}</Text>
            {d.signature?.at ? <Text style={s.muted}>Firmado en línea el {dt(d.signature.at)}</Text> : null}
          </View>
          {d.qr ? (
            <View style={{ alignItems: "center", width: 120 }}>
              <Image src={d.qr} style={{ width: 96, height: 96 }} />
              <Text style={[s.muted, { fontSize: 7, textAlign: "center" }]}>Ver la carpa en 3D y aceptar en línea</Text>
            </View>
          ) : null}
        </View>
      </Page>
    </Document>
  );
}

/** Accepts older snapshot shapes (seed) and fills defaults. */
export function normalizeSnapshot(raw: unknown, o?: { title: string; eventStart: Date | null; eventEnd: Date | null; periodStart: Date; periodEnd: Date } | undefined): Snapshot {
  const r = (raw ?? {}) as Partial<Snapshot> & { lines?: { description?: string; quantity: number; unitPrice: number; priceMode: string; discountPct: number; kind: string }[] };
  const rows = r.rows ?? (r.lines ?? []).map((l) => ({ description: l.description ?? l.kind, quantity: l.quantity, unitPrice: l.unitPrice, priceMode: l.priceMode, discountPct: l.discountPct ?? 0, kind: l.kind, taxRate: 21 }));
  return {
    rows,
    totals: r.totals ?? { gross: 0, lineDiscounts: 0, globalDiscount: 0, taxable: 0, vat: 0, total: 0, cost: 0, margin: 0, marginPct: 0, vatBreakdown: [] },
    tents: r.tents ?? [],
    terms: r.terms ?? "",
    days: r.days ?? 1,
    imageKey: r.imageKey ?? null,
    title: r.title ?? o?.title ?? "",
    eventStart: r.eventStart ?? o?.eventStart?.toISOString() ?? null,
    eventEnd: r.eventEnd ?? o?.eventEnd?.toISOString() ?? null,
    periodStart: r.periodStart ?? o?.periodStart.toISOString() ?? "",
    periodEnd: r.periodEnd ?? o?.periodEnd.toISOString() ?? "",
  };
}

async function storageDataUrl(keyOrUrl: string | null | undefined): Promise<string | null> {
  if (!keyOrUrl) return null;
  if (keyOrUrl.startsWith("data:")) return keyOrUrl;
  const key = keyOrUrl.startsWith("/api/files/") ? decodeURIComponent(keyOrUrl.slice("/api/files/".length)) : keyOrUrl.startsWith("http") ? null : keyOrUrl;
  if (!key) return null;
  const obj = await getObject(key).catch(() => null);
  if (!obj || !/^image\/(png|jpe?g)$/.test(obj.contentType)) return null;
  return `data:${obj.contentType};base64,${obj.body.toString("base64")}`;
}

/** A4 portrait is 1 : 1.414. Wider covers span the width (top aligned), taller ones the height. */
async function coverImage(url: string | null | undefined): Promise<{ src: string; fit: "width" | "height" } | null> {
  const src = await storageDataUrl(url);
  if (!src) return null;
  try {
    const sharp = (await import("sharp")).default;
    const m = await sharp(Buffer.from(src.slice(src.indexOf(",") + 1), "base64")).metadata();
    return { src, fit: m.width && m.height && m.height / m.width > 842 / 595 ? "height" : "width" };
  } catch {
    return { src, fit: "width" };
  }
}

export async function renderQuotePdf(tx: Tx, quoteId: string, tenantName: string): Promise<{ buffer: Buffer; fileName: string } | null> {
  const [q] = await tx.select().from(quotes).where(eq(quotes.id, quoteId));
  if (!q) return null;
  const [o] = await tx.select().from(orders).where(eq(orders.id, q.orderId));
  const [p] = o ? await tx.select().from(projects).where(eq(projects.id, o.projectId)) : [undefined];
  const [v] = p?.venueId ? await tx.select().from(venues).where(eq(venues.id, p.venueId)) : [undefined];
  const [c] = o?.clientId ? await tx.select().from(contacts).where(eq(contacts.id, o.clientId)) : [undefined];
  const [st] = await tx.select().from(tenantSettings);
  const snap = normalizeSnapshot(q.snapshot, o);
  const url = `${env.appUrl}/p/presupuesto/${q.publicToken}`;
  let plan: string | null = null;
  try {
    const comps = snap.tents.map((t) => compositionSchema.parse(t.composition));
    if (comps.length) {
      const merged: Composition = { version: 1, tents: comps.flatMap((x) => x.tents), gutters: comps.flatMap((x) => x.gutters), site: null };
      const cat = await loadCatalog(tx, { includeInactive: true });
      const svg = planToSvgString(merged, cat.families, { widthPx: 1400, title: snap.title });
      const sharp = (await import("sharp")).default;
      const png = await sharp(Buffer.from(svg)).flatten({ background: "#ffffff" }).png().toBuffer();
      plan = `data:image/png;base64,${png.toString("base64")}`;
    }
  } catch (e) {
    console.error("plan render failed", e);
  }
  const buffer = await renderToBuffer(
    <QuoteDoc
      d={{
        number: q.number,
        version: q.version,
        validUntil: q.validUntil,
        snap,
        tenant: {
          name: tenantName,
          legalName: st?.legalName ?? tenantName,
          taxId: st?.taxId ?? "",
          address: [st?.address, [st?.postalCode, st?.city].filter(Boolean).join(" "), st?.province].filter(Boolean).join(", "),
          phone: st?.phone ?? "",
          email: st?.email ?? "",
          logo: await storageDataUrl(st?.logoUrl),
        },
        cover: await coverImage(st?.quoteCoverUrl),
        client: c ? { name: c.name, taxId: c.taxId, email: c.email } : null,
        venue: v ? `${v.name}${v.city ? `, ${v.city}` : ""}` : p?.locationAddress ?? null,
        image: await storageDataUrl(snap.imageKey),
        plan,
        qr: await QRCode.toDataURL(url, { margin: 1, width: 240 }),
        url,
        signature: q.acceptedAt ? { name: q.signatureName, image: q.signatureImage, at: q.acceptedAt } : null,
      }}
    />,
  );
  return { buffer, fileName: `presupuesto-${q.number}.pdf` };
}
