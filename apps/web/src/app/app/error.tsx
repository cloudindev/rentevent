"use client";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-6">
      <ErrorState
        title="No hemos podido cargar esta pantalla"
        description={error.digest ? `Referencia del error: ${error.digest}` : "Comprueba tu conexión y vuelve a intentarlo."}
        action={<Button variant="outline" size="sm" onClick={reset}>Reintentar</Button>}
      />
    </div>
  );
}
