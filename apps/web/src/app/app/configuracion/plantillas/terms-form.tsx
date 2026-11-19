"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { saveQuoteTerms } from "@/server/actions/settings";

export function TermsForm({ quoteTerms, quoteValidityDays }: { quoteTerms: string; quoteValidityDays: number }) {
  const router = useRouter();
  const [terms, setTerms] = useState(quoteTerms);
  const [days, setDays] = useState(quoteValidityDays);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Condiciones del presupuesto</CardTitle>
          <CardDescription>Se imprimen al final de cada presupuesto y en la página de aceptación.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Condiciones" htmlFor="t-terms"><Textarea id="t-terms" rows={8} value={terms} onChange={(e) => setTerms(e.target.value)} /></Field>
        <div className="flex items-end justify-between gap-3">
          <Field label="Validez (días)" htmlFor="t-days"><Input id="t-days" type="number" min={1} className="w-28" value={days} onChange={(e) => setDays(Number(e.target.value))} /></Field>
          <Button disabled={pending} onClick={() => start(async () => { const r = await saveQuoteTerms({ quoteTerms: terms, quoteValidityDays: days }); if (r.ok) { toast.success("Condiciones guardadas"); router.refresh(); } else toast.error(r.error); })}>Guardar</Button>
        </div>
      </CardContent>
    </Card>
  );
}
