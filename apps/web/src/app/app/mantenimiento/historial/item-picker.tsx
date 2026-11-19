"use client";
import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/input";

export function ItemPicker({ items, value }: { items: { id: string; name: string; category: string }[]; value: string | null }) {
  const router = useRouter();
  const cats = [...new Set(items.map((i) => i.category))];
  return (
    <NativeSelect aria-label="Artículo" className="max-w-md" value={value ?? ""} onChange={(e) => router.push(e.target.value ? `/app/mantenimiento/historial?articulo=${e.target.value}` : "/app/mantenimiento/historial")}>
      <option value="">Elige un artículo…</option>
      {cats.map((c) => (
        <optgroup key={c} label={c}>
          {items.filter((i) => i.category === c).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </optgroup>
      ))}
    </NativeSelect>
  );
}
