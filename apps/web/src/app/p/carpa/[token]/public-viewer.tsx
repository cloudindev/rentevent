"use client";
import { useRef, useState } from "react";
import { Box } from "lucide-react";
import type { BomItem, BomRule, Composition, StructureFamily } from "@rentevent/core";
import { TentViewer, type TentViewerApi } from "@/components/tent3d";
import { Button } from "@/components/ui/button";

export function PublicViewer(props: { composition: Composition; families: StructureFamily[]; items: BomItem[]; rules: BomRule[] }) {
  const api = useRef<TentViewerApi>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex min-h-[60vh] flex-col gap-2">
      <TentViewer {...props} apiRef={api} className="min-h-[60vh] flex-1 bg-background" />
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={async () => {
            if (!api.current) return;
            setBusy(true);
            try {
              const blob = await api.current.toGLTF();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "carpa.glb";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Box /> Descargar glTF
        </Button>
      </div>
    </div>
  );
}
