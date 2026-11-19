"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { openPickList } from "@/server/actions/warehouse";

export function OpenListButton({ orderId, kind, label }: { orderId: string; kind: "salida" | "retorno"; label?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await openPickList({ orderId, kind });
          if (!r.ok) {
            toast.error(r.error);
            return;
          }
          router.push(`/app/almacen/${r.data.id}`);
        })
      }
    >
      <ClipboardList /> {label ?? (kind === "salida" ? "Crear lista de carga" : "Preparar retorno")}
    </Button>
  );
}
