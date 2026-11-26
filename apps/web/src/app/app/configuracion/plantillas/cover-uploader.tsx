"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Full-page cover printed before the first page of every quote PDF. */
export function CoverUploader({ coverUrl }: { coverUrl: string | null }) {
  const router = useRouter();
  const [url, setUrl] = useState(coverUrl);
  const [busy, setBusy] = useState(false);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Portada del presupuesto</CardTitle>
          <CardDescription>Imagen a página completa que sale como primera hoja del PDF del presupuesto. Tamaño A4 vertical (por ejemplo 2480 × 3508 px) para que se imprima nítida.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-start gap-4">
        <div className="flex aspect-[210/297] w-32 items-center justify-center overflow-hidden rounded-md border bg-subtle">
          {url ? <img src={url} alt="Portada del presupuesto" className="size-full object-contain object-top" /> : <span className="px-2 text-center text-xs text-muted-foreground">Sin portada</span>}
        </div>
        <div className="flex flex-col gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent">
            <Upload className="size-4" /> {busy ? "Subiendo…" : url ? "Cambiar portada" : "Subir portada"}
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              disabled={busy}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                setBusy(true);
                const fd = new FormData();
                fd.append("file", f);
                const res = await fetch("/app/configuracion/portada", { method: "POST", body: fd });
                const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
                setBusy(false);
                if (!res.ok || !j.url) {
                  toast.error(j.error ?? "No se pudo subir");
                  return;
                }
                setUrl(j.url);
                toast.success("Portada actualizada");
                router.refresh();
              }}
            />
          </label>
          {url ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const res = await fetch("/app/configuracion/portada", { method: "DELETE" });
                setBusy(false);
                if (!res.ok) {
                  toast.error("No se pudo quitar");
                  return;
                }
                setUrl(null);
                toast.success("Portada quitada");
                router.refresh();
              }}
            >
              <Trash2 className="size-4" /> Quitar portada
            </Button>
          ) : null}
          <span className="text-xs text-muted-foreground">PNG o JPG · máx. 8 MB</span>
        </div>
      </CardContent>
    </Card>
  );
}
