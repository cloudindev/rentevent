"use client";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty";

export default function WorkerError({ reset }: { error: Error; reset: () => void }) {
  return (
    <ErrorState
      title="No se ha podido cargar"
      description="Si estás sin cobertura, tus fichajes y partes se guardan en el móvil y se enviarán al recuperar la conexión."
      action={
        <Button size="sm" variant="outline" onClick={reset}>
          Reintentar
        </Button>
      }
    />
  );
}
