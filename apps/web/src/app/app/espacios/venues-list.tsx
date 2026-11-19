"use client";
import Link from "next/link";
import { useState } from "react";
import { MapPin, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EMPTY_VENUE, GROUND_LABELS, VenueSheet, type VenueForm } from "./venue-form";

type Row = VenueForm & { id: string; geocoded: boolean; hasPlan: boolean; projects: number };

export function VenuesList({ rows, contacts, canEdit }: { rows: Row[]; contacts: { id: string; name: string }[]; canEdit: boolean }) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<VenueForm | null>(null);
  const filtered = rows.filter((r) => !q || `${r.name} ${r.city} ${r.address}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar espacio…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar espacio" />
        </div>
        <div className="flex-1" />
        {canEdit && (
          <Button onClick={() => setEditing({ ...EMPTY_VENUE })}>
            <Plus /> Nuevo espacio
          </Button>
        )}
      </div>
      {filtered.length === 0 ? (
        <EmptyState icon={MapPin} title={rows.length ? "Ningún espacio coincide" : "Aún no hay espacios"} description="Guarda los recintos donde montas con sus accesos, tipo de suelo y si se puede anclar." action={canEdit && !rows.length ? <Button onClick={() => setEditing({ ...EMPTY_VENUE })}>Añadir el primero</Button> : undefined} />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Espacio</TH>
              <TH>Suelo</TH>
              <TH>Fijación</TH>
              <TH>Plano</TH>
              <TH className="text-right">Proyectos</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((r) => (
              <TR key={r.id}>
                <TD>
                  <Link href={`/app/espacios/${r.id}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">
                    {r.city || r.address}
                    {!r.geocoded && " · sin ubicar"}
                  </span>
                </TD>
                <TD className="text-muted-foreground">{GROUND_LABELS[r.groundType] ?? r.groundType}</TD>
                <TD>{r.anchoringAllowed ? <StatusPill tone="success">Anclaje permitido</StatusPill> : <StatusPill tone="warning">Solo pesos</StatusPill>}</TD>
                <TD>{r.hasPlan ? <StatusPill tone="info">Con plano</StatusPill> : <span className="text-xs text-muted-foreground">—</span>}</TD>
                <TD className="tabular text-right">{r.projects}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {editing && <VenueSheet key={editing.id ?? "new"} initial={editing} contacts={contacts} onClose={() => setEditing(null)} />}
    </div>
  );
}
