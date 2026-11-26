"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteTemplate } from "@/server/actions/tents";

export function TemplateActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-1">
      <Button asChild size="sm" variant="outline">
        <Link href={`/app/pedidos/nuevo?plantilla=${id}`}>Usar</Link>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          confirm("¿Eliminar la plantilla?") &&
          start(async () => {
            const r = await deleteTemplate({ id });
            if (!r.ok) return void toast.error(r.error);
            toast.success("Plantilla eliminada");
            router.refresh();
          })
        }
      >
        Eliminar
      </Button>
    </div>
  );
}
