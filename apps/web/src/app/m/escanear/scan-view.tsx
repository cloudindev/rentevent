"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Package } from "lucide-react";
import { StatusPill } from "@/components/ui/badge";
import { QrScanner } from "@/components/crew/qr-scanner";
import { lookupQr } from "@/server/actions/crew";

type Hit = Awaited<ReturnType<typeof lookupQr>>;
const UNIT_TONE: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = { disponible: "success", en_obra: "info", reparacion: "danger", limpieza: "warning", baja: "neutral" };

export function ScanView({ returnTo }: { returnTo: string | null }) {
  const router = useRouter();
  const [history, setHistory] = useState<{ code: string; hit: Hit }[]>([]);
  const [busy, start] = useTransition();
  const onScan = (code: string) => {
    if (returnTo) {
      const sep = returnTo.includes("?") ? "&" : "?";
      router.push(`${returnTo}${sep}codigo=${encodeURIComponent(code)}`);
      return;
    }
    start(async () => {
      const hit = await lookupQr(code);
      setHistory((h) => [{ code, hit }, ...h].slice(0, 15));
    });
  };
  return (
    <div className="space-y-4">
      <QrScanner onScan={onScan} paused={busy} />
      {history.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">Los códigos escaneados aparecerán aquí con su artículo.</p>
      ) : (
        <ul className="space-y-2" aria-live="polite">
          {history.map(({ code, hit }, i) => (
            <li key={`${code}-${i}`} className="flex items-start gap-3 rounded-xl border bg-background p-3 text-sm">
              <Package className="mt-0.5 size-5 text-muted-foreground" />
              {hit.ok ? (
                <div className="flex-1">
                  <p className="font-medium">{hit.item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {hit.unit ? `Unidad ${hit.unit.serial}` : `Ref. ${hit.item.sku}`}
                    {hit.item.location && ` · Ubicación ${hit.item.location}`}
                  </p>
                  {hit.unit && <StatusPill className="mt-1.5" tone={UNIT_TONE[hit.unit.status] ?? "neutral"}>{hit.unit.status.replace("_", " ")}</StatusPill>}
                </div>
              ) : (
                <div className="flex-1">
                  <p className="font-medium">{code}</p>
                  <p className="text-xs text-danger">{hit.error}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
