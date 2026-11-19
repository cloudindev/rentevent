"use client";
import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Canvas signature pad (pointer events: mouse, pen and touch). Emits a PNG data URL or null when empty. */
export function SignaturePad({ onChange, height = 180 }: { onChange: (png: string | null) => void; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current!;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const w = c.clientWidth;
      c.width = w * ratio;
      c.height = height * ratio;
      const ctx = c.getContext("2d")!;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111";
      setEmpty(true);
      onChange(null);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top] as const;
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={ref}
        role="img"
        aria-label="Zona de firma: dibuja tu firma con el dedo o el ratón"
        className="w-full touch-none rounded-lg border border-dashed border-border-strong bg-white"
        style={{ height }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const ctx = e.currentTarget.getContext("2d")!;
          const [x, y] = pos(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 0.1, y + 0.1);
          ctx.stroke();
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext("2d")!;
          const [x, y] = pos(e);
          ctx.lineTo(x, y);
          ctx.stroke();
        }}
        onPointerUp={(e) => {
          if (!drawing.current) return;
          drawing.current = false;
          setEmpty(false);
          onChange(e.currentTarget.toDataURL("image/png"));
        }}
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{empty ? "Firma dentro del recuadro" : "Firma recogida"}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            const c = ref.current!;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            setEmpty(true);
            onChange(null);
          }}
        >
          <Eraser /> Borrar
        </Button>
      </div>
    </div>
  );
}
