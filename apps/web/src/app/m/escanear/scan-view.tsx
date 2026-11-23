"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Box, Package } from "lucide-react";
import { StatusPill } from "@/components/ui/badge";
import { QrScanner } from "@/components/crew/qr-scanner";
import { lookupQr } from "@/server/actions/crew";

type Hit = Awaited<ReturnType<typeof lookupQr>>;
import { UNIT_STATUS_LABEL, UNIT_STATUS_TONE } from "@/server/warehouse/logic";

export function ScanView({ returnTo, initialCode }: { returnTo: string | null; initialCode?: string | null }) {
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
  const consumed = useRef(false);
  useEffect(() => {
    if (initialCode && !returnTo && !consumed.current) {
      consumed.current = true;
      onScan(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode]);
  return (
    <div className="space-y-4">
      <QrScanner onScan={onScan} paused={busy} />
      {history.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">Los códigos escaneados aparecerán aquí con su artículo.</p>
      ) : (
        <ul className="space-y-2" aria-live="polite">
          {history.map(({ code, hit }, i) => (
            <li key={`${code}-${i}`} className="flex items-start gap-3 rounded-xl border bg-background p-3 text-sm">
              {hit.ok && hit.item.container ? <Box className="mt-0.5 size-5 text-muted-foreground" /> : <Package className="mt-0.5 size-5 text-muted-foreground" />}
              {hit.ok ? (
                <div className="flex-1">
                  <p className="font-medium">{hit.item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {hit.unit ? `Unidad ${hit.unit.serial}` : `Ref. ${hit.item.sku}`}
                    {hit.where && ` · ${hit.where}`}
                  </p>
                  {hit.unit && <StatusPill className="mt-1.5" tone={UNIT_STATUS_TONE[hit.unit.status] ?? "neutral"}>{UNIT_STATUS_LABEL[hit.unit.status] ?? hit.unit.status}</StatusPill>}
                  {hit.contents && (
                    <div className="mt-2 rounded-lg bg-subtle px-2.5 py-2 text-xs">
                      <p className="font-medium">{hit.contents.length ? `Lleva dentro (${hit.contents.length})` : "Vacía"}</p>
                      {hit.contents.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-muted-foreground">
                          {hit.contents.slice(0, 12).map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                          {hit.contents.length > 12 && <li>y {hit.contents.length - 12} más</li>}
                        </ul>
                      )}
                    </div>
                  )}
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
