"use client";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { DEFAULT_LABOR } from "@rentevent/core";
import { Button } from "@/components/ui/button";
import { saveFamily } from "@/server/actions/tents";

export function NewFamilyButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await saveFamily({
            id: null,
            code: `NUEVA${Math.floor(Math.random() * 900 + 100)}`,
            name: "Nueva familia",
            width: 10,
            moduleLength: 5,
            eaveHeight: 2.6,
            ridgeHeight: 4.2,
            heightClass: "baja",
            roofShape: "dos_aguas",
            trussItemId: null,
            minModules: 1,
            maxModules: 20,
            priceMode: "m2",
            price: 0,
            active: true,
            parameters: { correas_por_tramo: 5, pesos_por_pata: 1, estacas_por_pata: 2, tensores_por_arriostramiento: 4, peso_kg: 500 },
            labor: DEFAULT_LABOR,
          });
          if (!r.ok) { toast.error(r.error); return; }
          router.push(`/app/carpas/${r.data.id}`);
        })
      }
    >
      <Plus /> Nueva familia
    </Button>
  );
}
