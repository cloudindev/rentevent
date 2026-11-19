"use client";
import { Command } from "cmdk";
import { Dialog as D } from "radix-ui";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, useTransition } from "react";
import { Boxes, Briefcase, FilePlus2, ListChecks, Search, Tent, UserPlus, Users, CalendarPlus, PackagePlus } from "lucide-react";
import { can } from "@/lib/permissions";
import { NAV, SETTINGS_ITEM } from "./nav";
import { globalSearch, type SearchHit } from "@/server/actions/search";

const Ctx = createContext<{ open: boolean; setOpen: (o: boolean) => void }>({ open: false, setOpen: () => {} });
export const useCommandPalette = () => useContext(Ctx);

const CREATE = [
  { label: "Nuevo pedido", href: "/app/pedidos/nuevo", icon: FilePlus2, permission: "comercial" as const },
  { label: "Nuevo proyecto", href: "/app/proyectos?nuevo=1", icon: CalendarPlus, permission: "comercial" as const },
  { label: "Nuevo contacto", href: "/app/contactos?nuevo=1", icon: UserPlus, permission: "comercial" as const },
  { label: "Nuevo artículo", href: "/app/inventario?nuevo=1", icon: PackagePlus, permission: "inventario" as const },
  { label: "Nueva familia de carpa", href: "/app/carpas?nuevo=1", icon: Tent, permission: "carpas" as const },
];

const HIT_ICON = { pedido: ListChecks, proyecto: Briefcase, contacto: Users, articulo: Boxes } as const;

export function CommandPaletteProvider({ role, children }: { role: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => start(async () => setHits(await globalSearch(q))), 180);
    return () => clearTimeout(t);
  }, [q]);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };
  const nav = useMemo(() => [...NAV.flatMap((g) => g.items), SETTINGS_ITEM].filter((i) => can(role, i.permission)), [role]);

  return (
    <Ctx.Provider value={{ open, setOpen }}>
      {children}
      <D.Root open={open} onOpenChange={setOpen}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-black/25" />
          <D.Content className="fixed left-1/2 top-[14vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-popover shadow-2xl">
            <D.Title className="sr-only">Acciones rápidas</D.Title>
            <D.Description className="sr-only">Navega, crea registros o busca en tus datos</D.Description>
            <Command shouldFilter={true} label="Acciones rápidas">
              <div className="flex items-center gap-2 border-b px-4">
                <Search className="size-4 text-muted-foreground" />
                <Command.Input value={q} onValueChange={setQ} placeholder="Busca pedidos, clientes, artículos o escribe una acción…" className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                {pending && <span className="size-3 animate-pulse rounded-full bg-muted" aria-label="Buscando" />}
              </div>
              <Command.List className="max-h-[50vh] overflow-y-auto p-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted-foreground">
                <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">Sin resultados</Command.Empty>
                {hits.length > 0 && (
                  <Command.Group heading="Resultados">
                    {hits.map((h) => {
                      const I = HIT_ICON[h.type];
                      return (
                        <Command.Item key={`${h.type}-${h.id}`} value={`${h.title} ${h.subtitle} ${h.id}`} onSelect={() => go(h.href)} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm data-[selected=true]:bg-accent">
                          <I className="size-4 text-muted-foreground" />
                          <span className="flex-1 truncate">{h.title}</span>
                          <span className="truncate text-xs text-muted-foreground">{h.subtitle}</span>
                        </Command.Item>
                      );
                    })}
                  </Command.Group>
                )}
                <Command.Group heading="Crear">
                  {CREATE.filter((c) => can(role, c.permission)).map((c) => (
                    <Command.Item key={c.href} value={c.label} onSelect={() => go(c.href)} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm data-[selected=true]:bg-accent">
                      <c.icon className="size-4 text-muted-foreground" /> {c.label}
                    </Command.Item>
                  ))}
                </Command.Group>
                <Command.Group heading="Ir a">
                  {nav.map((n) => (
                    <Command.Item key={n.href} value={`${n.label} ${n.keywords ?? ""}`} onSelect={() => go(n.href)} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm data-[selected=true]:bg-accent">
                      <n.icon className="size-4 text-muted-foreground" strokeWidth={1.6} /> {n.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              </Command.List>
            </Command>
          </D.Content>
        </D.Portal>
      </D.Root>
    </Ctx.Provider>
  );
}
