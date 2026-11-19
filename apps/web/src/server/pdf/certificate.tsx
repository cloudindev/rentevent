import "server-only";
/* eslint-disable jsx-a11y/alt-text -- @react-pdf Image elements have no alt attribute */
import { Document, Image, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { compositionSchema } from "@rentevent/core";
import { assignments, contacts, eq, inArray, orders, projects, shifts, structureFamilies, tenantSettings, tentConfigurations, venues, workers, type Tx } from "@rentevent/db";
import { pdfStyles as s, tenantLogo } from "./delivery-note";

const d = (x: Date | null | undefined) => (x ? new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "long", year: "numeric" }).format(x) : "—");

/** Installation certificate generated from a fixed template for an order. */
export async function renderCertificatePdf(tx: Tx, orderId: string, tenantName: string): Promise<{ buffer: Buffer; fileName: string } | null> {
  const [o] = await tx.select().from(orders).where(eq(orders.id, orderId));
  if (!o) return null;
  const [p] = await tx.select().from(projects).where(eq(projects.id, o.projectId));
  const [v] = p?.venueId ? await tx.select().from(venues).where(eq(venues.id, p.venueId)) : [undefined];
  const [c] = o.clientId ? await tx.select().from(contacts).where(eq(contacts.id, o.clientId)) : [undefined];
  const [st] = await tx.select().from(tenantSettings);
  const configs = await tx.select().from(tentConfigurations).where(eq(tentConfigurations.orderId, orderId));
  const fams = await tx.select().from(structureFamilies);
  const montaje = await tx.select({ id: shifts.id }).from(shifts).where(eq(shifts.orderId, orderId));
  const crew = montaje.length
    ? await tx.select({ name: workers.name, skills: workers.skills }).from(assignments).innerJoin(workers, eq(workers.id, assignments.workerId)).where(inArray(assignments.shiftId, montaje.map((m) => m.id)))
    : [];
  const lead = crew.find((w) => w.skills.includes("jefe_equipo"))?.name ?? crew[0]?.name ?? "";
  const logo = await tenantLogo(st?.logoUrl);
  const structures = configs.flatMap((cfg) => {
    const comp = compositionSchema.safeParse(cfg.composition);
    if (!comp.success) return [];
    return comp.data.tents.map((t) => {
      const f = fams.find((x) => x.id === t.config.familyId);
      const length = f ? (f.roofShape === "jaima" ? f.width : t.config.modules * f.moduleLength) : 0;
      return {
        label: t.label || f?.name || "Estructura",
        dims: f ? `${f.width} × ${length} m` : "—",
        height: f ? `${f.eaveHeight} / ${f.ridgeHeight} m` : "—",
        roof: f?.roofShape === "poligonal" ? "Poligonal" : f?.roofShape === "jaima" ? "Jaima" : "Dos aguas",
        anchoring: t.config.anchoring === "pesos" ? `Lastre con pesos (${f?.parameters?.pesos_por_pata ?? "—"} por pata de ${f?.parameters?.peso_kg ?? "—"} kg)` : `Anclaje al terreno (${f?.parameters?.estacas_por_pata ?? "—"} estacas por pata)`,
        area: f ? f.width * length : 0,
      };
    });
  });
  const doc = (
    <Document title={`Certificado de instalación ${o.number}`} author={st?.legalName || tenantName}>
      <Page size="A4" style={[s.page, { fontSize: 10 }]}>
        <View style={[s.between, { marginBottom: 26 }]}>
          {logo ? <Image src={logo} style={{ height: 34, objectFit: "contain" }} /> : <Text style={[s.bold, { fontSize: 14 }]}>{tenantName}</Text>}
          <Text style={s.muted}>Pedido {o.number}</Text>
        </View>
        <Text style={[s.h1, { marginBottom: 4 }]}>Certificado de montaje e instalación</Text>
        <Text style={[s.muted, { marginBottom: 18 }]}>Estructuras temporales desmontables (carpas)</Text>
        <Text style={{ lineHeight: 1.5, marginBottom: 14 }}>
          {st?.legalName || tenantName}, con NIF {st?.taxId || "—"} y domicilio en {[st?.address, st?.postalCode, st?.city, st?.province].filter(Boolean).join(", ") || "—"}, CERTIFICA que ha realizado el montaje de las estructuras que se detallan a continuación para {c?.legalName || c?.name || "el cliente"}
          {c?.taxId ? ` (NIF ${c.taxId})` : ""}, con motivo de «{o.title}», en {v ? `${v.name}${v.city ? `, ${v.city}` : ""}` : p?.locationAddress || "el emplazamiento indicado por el cliente"}.
        </Text>
        <View style={[s.row, s.line]}>
          <Text style={[s.th, { flex: 3 }]}>Estructura</Text>
          <Text style={[s.th, { flex: 1.4 }]}>Medidas</Text>
          <Text style={[s.th, { flex: 1.4 }]}>Alero / cumbrera</Text>
          <Text style={[s.th, { flex: 1 }]}>Cubierta</Text>
          <Text style={[s.th, { flex: 3 }]}>Fijación</Text>
        </View>
        {structures.length === 0 ? (
          <Text style={[s.td, s.muted]}>Sin estructuras configuradas en el pedido.</Text>
        ) : (
          structures.map((x, i) => (
            <View key={i} style={[s.row, s.line]} wrap={false}>
              <Text style={[s.td, { flex: 3 }]}>{x.label}</Text>
              <Text style={[s.td, { flex: 1.4 }]}>{x.dims}</Text>
              <Text style={[s.td, { flex: 1.4 }]}>{x.height}</Text>
              <Text style={[s.td, { flex: 1 }]}>{x.roof}</Text>
              <Text style={[s.td, { flex: 3 }]}>{x.anchoring}</Text>
            </View>
          ))
        )}
        <Text style={{ lineHeight: 1.5, marginTop: 16 }}>
          El montaje se ha ejecutado siguiendo las instrucciones del fabricante de la estructura, con los elementos de arriostramiento, lastre o anclaje previstos para cada familia, y comprobando a su finalización la verticalidad de los pórticos, la tensión de las lonas y el estado de los elementos de fijación. Superficie total cubierta: {structures.reduce((t, x) => t + x.area, 0)} m².
        </Text>
        <Text style={{ lineHeight: 1.5, marginTop: 8 }}>
          El usuario deberá respetar las condiciones de uso: no cargar la estructura con elementos no previstos, mantener cerrados los laterales en caso de viento y desalojar la carpa si la velocidad del viento supera la indicada por el fabricante o si se acumula nieve sobre la cubierta.
        </Text>
        <Text style={{ marginTop: 14 }}>Periodo de instalación: del {d(o.periodStart)} al {d(o.periodEnd)}. Evento: {d(o.eventStart)}.</Text>
        <View style={[s.row, { gap: 24, marginTop: 40 }]}>
          <View style={{ flex: 1 }}>
            <View style={{ height: 60, borderBottomWidth: 1, borderBottomColor: "#999" }} />
            <Text style={s.muted}>Responsable de montaje{lead ? `: ${lead}` : ""}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ height: 60, borderBottomWidth: 1, borderBottomColor: "#999" }} />
            <Text style={s.muted}>Por {st?.legalName || tenantName}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ height: 60, borderBottomWidth: 1, borderBottomColor: "#999" }} />
            <Text style={s.muted}>Conforme, el cliente</Text>
          </View>
        </View>
        <Text style={[s.muted, { marginTop: 24, fontSize: 8 }]}>Documento emitido el {d(new Date())}. Este certificado no sustituye a los proyectos o licencias que exija la normativa municipal para estructuras temporales.</Text>
      </Page>
    </Document>
  );
  return { buffer: await renderToBuffer(doc), fileName: `certificado-instalacion-${o.number}.pdf` };
}
