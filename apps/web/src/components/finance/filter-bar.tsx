import { Search } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";

export type FilterField =
  | { type: "search"; name: string; placeholder: string }
  | { type: "select"; name: string; label: string; options: { value: string; label: string }[] }
  | { type: "date"; name: string; label: string };

/** Plain GET form: works without JS and keeps filters in the URL. */
export function FilterBar({ fields, values, hidden, resetHref }: { fields: FilterField[]; values: Record<string, string | undefined>; hidden?: Record<string, string>; resetHref: string }) {
  const active = fields.some((f) => values[f.name]);
  return (
    <form method="get" className="flex flex-wrap items-end gap-2" role="search">
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {fields.map((f) =>
        f.type === "search" ? (
          <div key={f.name} className="relative min-w-52 flex-1 sm:max-w-72">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input name={f.name} defaultValue={values[f.name] ?? ""} placeholder={f.placeholder} className="pl-8" aria-label={f.placeholder} />
          </div>
        ) : f.type === "select" ? (
          <NativeSelect key={f.name} name={f.name} defaultValue={values[f.name] ?? ""} aria-label={f.label} className="w-auto min-w-36">
            <option value="">{f.label}: todos</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <label key={f.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {f.label}
            <Input type="date" name={f.name} defaultValue={values[f.name] ?? ""} className="w-auto" />
          </label>
        ),
      )}
      <Button type="submit" variant="outline">
        Filtrar
      </Button>
      {active && (
        <Button asChild variant="ghost">
          <Link href={resetHref}>Limpiar</Link>
        </Button>
      )}
    </form>
  );
}
