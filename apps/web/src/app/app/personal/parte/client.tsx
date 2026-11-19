"use client";
import { useRouter } from "next/navigation";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PrintButton() {
  return (
    <Button size="sm" variant="outline" onClick={() => window.print()}>
      <Printer /> Imprimir
    </Button>
  );
}

export function DatePicker({ value }: { value: string }) {
  const router = useRouter();
  return <Input type="date" aria-label="Fecha del parte" className="h-8 w-40" value={value} onChange={(e) => e.target.value && router.push(`/app/personal/parte?date=${e.target.value}`)} />;
}
