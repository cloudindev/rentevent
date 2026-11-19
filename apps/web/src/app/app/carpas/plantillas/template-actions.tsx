"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
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
            await deleteTemplate({ id });
            router.refresh();
          })
        }
      >
        Eliminar
      </Button>
    </div>
  );
}
