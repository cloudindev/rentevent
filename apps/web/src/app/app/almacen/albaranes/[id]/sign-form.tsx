"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { SignaturePad } from "@/components/warehouse/signature-pad";
import { signDeliveryNote } from "@/server/actions/warehouse";

export function SignForm({ id }: { id: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sig, setSig] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold">Firma del cliente</h2>
      <Field label="Nombre de quien firma" htmlFor="sig-name">
        <Input id="sig-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </Field>
      <SignaturePad onChange={setSig} />
      <Button
        disabled={pending || !sig || name.trim().length < 2}
        onClick={() =>
          start(async () => {
            const r = await signDeliveryNote({ id, name, signature: sig! });
            if (!r.ok) {
              toast.error(r.fieldErrors?.name ?? r.error);
              return;
            }
            toast.success("Albarán firmado");
            router.refresh();
          })
        }
      >
        Guardar firma
      </Button>
    </section>
  );
}
