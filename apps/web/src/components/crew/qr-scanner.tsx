"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/**
 * Reusable QR scanner: native BarcodeDetector when available, @zxing/browser
 * otherwise, plus manual code entry. `onScan` receives each distinct code
 * (debounced 2 s for repeats). Used by the worker app and the warehouse.
 */
export function QrScanner({ onScan, paused = false }: { onScan: (code: string) => void; paused?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const last = useRef<{ code: string; at: number } | null>(null);
  const cb = useRef(onScan);
  const pausedRef = useRef(paused);
  useEffect(() => {
    cb.current = onScan;
    pausedRef.current = paused;
  });

  useEffect(() => {
    if (!active) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    const emit = (code: string) => {
      if (pausedRef.current) return;
      const now = Date.now();
      if (last.current && last.current.code === code && now - last.current.at < 2000) return;
      last.current = { code, at: now };
      if ("vibrate" in navigator) navigator.vibrate?.(60);
      cb.current(code.trim());
    };
    (async () => {
      try {
        const Native = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        if (Native) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
          if (cancelled) return stream.getTracks().forEach((t) => t.stop());
          const v = video.current!;
          v.srcObject = stream;
          await v.play();
          const detector = new Native({ formats: ["qr_code", "code_128", "ean_13"] });
          let raf = 0;
          const loop = async () => {
            if (cancelled) return;
            try {
              const codes = await detector.detect(v);
              if (codes[0]?.rawValue) emit(codes[0].rawValue);
            } catch {
              /* frame not ready */
            }
            raf = window.setTimeout(loop, 250) as unknown as number;
          };
          loop();
          stop = () => {
            clearTimeout(raf);
            stream.getTracks().forEach((t) => t.stop());
          };
        } else {
          const { BrowserQRCodeReader } = await import("@zxing/browser");
          const reader = new BrowserQRCodeReader();
          const controls = await reader.decodeFromConstraints({ video: { facingMode: "environment" } }, video.current!, (result) => {
            if (result) emit(result.getText());
          });
          if (cancelled) controls.stop();
          stop = () => controls.stop();
        }
      } catch (e) {
        setError(e instanceof Error && /Permission|NotAllowed/i.test(e.name + e.message) ? "No hay permiso para usar la cámara. Introduce el código a mano." : "No se ha podido abrir la cámara. Introduce el código a mano.");
        setActive(false);
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [active]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-ink">
        <video ref={video} className="h-full w-full object-cover" muted playsInline aria-label="Vista de la cámara" />
        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            <Camera className="size-8 opacity-70" />
            <p className="text-sm opacity-80">Apunta al código QR de la pieza o de su etiqueta.</p>
            <Button onClick={() => (setError(null), setActive(true))}>Activar cámara</Button>
          </div>
        )}
        {active && <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/80" aria-hidden />}
        {active && (
          <Button size="sm" variant="secondary" className="absolute right-3 top-3" onClick={() => setActive(false)}>
            <CameraOff /> Parar
          </Button>
        )}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) cb.current(manual.trim());
          setManual("");
        }}
      >
        <div className="relative flex-1">
          <Keyboard className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Código o referencia" value={manual} onChange={(e) => setManual(e.target.value)} aria-label="Código manual" autoCapitalize="characters" />
        </div>
        <Button variant="outline" disabled={!manual.trim()}>
          Buscar
        </Button>
      </form>
    </div>
  );
}
