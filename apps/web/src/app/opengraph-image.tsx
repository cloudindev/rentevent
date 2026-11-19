import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Rentevent · Software para empresas de carpas y eventos";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), "public/brand/rentevent-logo-white.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#111111", padding: 72, color: "white" }}>
        <img src={src} alt="" height={56} style={{ height: 56, width: 316 }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>El software que sabe lo que es una carpa.</div>
          <div style={{ marginTop: 28, fontSize: 30, color: "rgba(255,255,255,0.7)" }}>Despiece automático · stock en vivo · presupuestos con 3D</div>
        </div>
        <div style={{ display: "flex", width: 160, height: 10, background: "#F95F40", borderRadius: 5 }} />
      </div>
    ),
    size,
  );
}
