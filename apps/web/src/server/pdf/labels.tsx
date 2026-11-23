import "server-only";
/* eslint-disable jsx-a11y/alt-text -- @react-pdf Image elements have no alt attribute */
import { Document, Image, Page, Text, View, renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { labelUrl } from "../warehouse/logic";

export type LabelUnit = { serial: string; qrCode: string; itemName: string; container: string | null };

const MM = 72 / 25.4;
// A4, 3 × 8 labels of 70 × 37 mm (common adhesive sheets, e.g. 24 per page)
const COLS = 3;
const ROWS = 8;
const W = 70 * MM;
const H = 37 * MM;
const TOP = (297 * MM - ROWS * H) / 2;

/** Sheet of QR labels: each QR opens the unit's page (…/q/<code>), and the in-app scanners read it too. */
export async function renderLabelsPdf(units: LabelUnit[], opts: { appUrl: string; tenantName: string }) {
  const qrs = await Promise.all(units.map((u) => QRCode.toDataURL(labelUrl(opts.appUrl, u.qrCode), { margin: 0, width: 240, errorCorrectionLevel: "M" })));
  const pages: LabelUnit[][] = [];
  for (let i = 0; i < units.length; i += COLS * ROWS) pages.push(units.slice(i, i + COLS * ROWS));
  const doc = (
    <Document title="Etiquetas QR" author={opts.tenantName}>
      {pages.map((page, p) => (
        <Page key={p} size="A4" style={{ paddingTop: TOP, flexDirection: "row", flexWrap: "wrap", fontFamily: "Helvetica", color: "#111" }}>
          {page.map((u, i) => (
            <View key={u.qrCode} style={{ width: W, height: H, flexDirection: "row", alignItems: "center", paddingHorizontal: 4 * MM, gap: 3 * MM }}>
              <Image src={qrs[p * COLS * ROWS + i]!} style={{ width: 27 * MM, height: 27 * MM }} />
              <View style={{ flex: 1 }}>
                {u.container && <Text style={{ fontSize: 6, color: "#6b6b68", textTransform: "uppercase", marginBottom: 1.5 }}>{u.container === "caja" ? "Caja" : "Conjunto"}</Text>}
                <Text style={{ fontSize: 7.5, maxLines: 2 }}>{u.itemName}</Text>
                <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 2 }}>{u.serial}</Text>
                <Text style={{ fontSize: 6, color: "#6b6b68", marginTop: 3, maxLines: 1 }}>{opts.tenantName}</Text>
              </View>
            </View>
          ))}
        </Page>
      ))}
    </Document>
  );
  return renderToBuffer(doc);
}
