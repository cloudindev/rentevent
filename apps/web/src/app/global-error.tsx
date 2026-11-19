"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", margin: 0, background: "#fff", color: "#111" }}>
        <main style={{ textAlign: "center", padding: 24 }}>
          <p style={{ fontSize: 64, fontWeight: 700, margin: 0, color: "#ddd" }}>500</p>
          <h1 style={{ fontSize: 24 }}>Rentevent no ha podido cargar</h1>
          <p style={{ color: "#6b6b68" }}>Inténtalo de nuevo en unos segundos.{error.digest ? ` Referencia: ${error.digest}` : ""}</p>
          <button onClick={reset} style={{ marginTop: 16, background: "#111", color: "#fff", border: 0, borderRadius: 10, padding: "10px 18px", fontSize: 14, cursor: "pointer" }}>
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
