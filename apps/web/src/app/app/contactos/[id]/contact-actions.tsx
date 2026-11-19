"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, MapPin, Pencil, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/menu";
import { archiveContact, deleteAddress, deletePerson, saveAddress, savePerson } from "@/server/actions/contacts";
import { ContactSheet, type ContactForm } from "../contact-sheet";

type Addr = { id: string | null; label: string; line1: string; city: string; province: string; postalCode: string; isDefault: boolean };
type Person = { id: string | null; name: string; position: string | null; email: string | null; phone: string | null };

export function ContactActions({ contact, archived, addresses, persons }: { contact: ContactForm & { id: string }; archived: boolean; addresses: Addr[]; persons: Person[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [addrOpen, setAddrOpen] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  const [addr, setAddr] = useState<Addr>({ id: null, label: "Principal", line1: "", city: "", province: "", postalCode: "", isDefault: addresses.length === 0 });
  const [person, setPerson] = useState<Person>({ id: null, name: "", position: null, email: null, phone: null });
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setAddrOpen(true)}><MapPin /> Direcciones</Button>
      <Button variant="outline" size="sm" onClick={() => setPersonOpen(true)}><UserPlus /> Personas</Button>
      <Button variant="ghost" size="sm" onClick={() => start(async () => { await archiveContact({ id: contact.id, archived: !archived }); router.refresh(); })}><Archive /> {archived ? "Recuperar" : "Archivar"}</Button>
      <Button size="sm" onClick={() => setEdit(true)}><Pencil /> Editar</Button>
      <ContactSheet open={edit} onOpenChange={setEdit} initial={contact} />
      <Sheet open={addrOpen} onOpenChange={setAddrOpen} title="Direcciones" description="Se geocodifican al guardar para calcular distancias y rutas.">
        <div className="space-y-4">
          {addresses.map((a) => (
            <div key={a.id} className="flex items-start justify-between rounded-lg border p-3 text-sm">
              <button className="text-left" onClick={() => setAddr(a)}>
                <p className="font-medium">{a.label}</p>
                <p className="text-muted-foreground">{a.line1}, {a.city}</p>
              </button>
              <Button variant="ghost" size="icon-sm" aria-label="Eliminar dirección" onClick={() => start(async () => { await deleteAddress({ id: a.id!, contactId: contact.id }); router.refresh(); })}><Trash2 /></Button>
            </div>
          ))}
          <form
            className="grid grid-cols-2 gap-3 rounded-lg border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await saveAddress({ ...addr, contactId: contact.id });
                if (!r.ok) { toast.error(r.error); return; }
                toast.success(r.data.precision ? `Geocodificada (${r.data.precision})` : "Guardada sin coordenadas");
                setAddr({ id: null, label: "Otra", line1: "", city: "", province: "", postalCode: "", isDefault: false });
                router.refresh();
              });
            }}
          >
            <p className="col-span-2 text-sm font-medium">{addr.id ? "Editar dirección" : "Nueva dirección"}</p>
            <Field label="Etiqueta" htmlFor="a-l"><Input id="a-l" value={addr.label} onChange={(e) => setAddr({ ...addr, label: e.target.value })} /></Field>
            <Field label="C. P." htmlFor="a-cp"><Input id="a-cp" value={addr.postalCode} onChange={(e) => setAddr({ ...addr, postalCode: e.target.value })} /></Field>
            <Field label="Dirección" htmlFor="a-1" className="col-span-2"><Input id="a-1" value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} /></Field>
            <Field label="Población" htmlFor="a-c"><Input id="a-c" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} /></Field>
            <Field label="Provincia" htmlFor="a-p"><Input id="a-p" value={addr.province} onChange={(e) => setAddr({ ...addr, province: e.target.value })} /></Field>
            <label className="col-span-2 flex items-center gap-2 text-sm"><Switch checked={addr.isDefault} onCheckedChange={(v) => setAddr({ ...addr, isDefault: v })} /> Principal</label>
            <Button className="col-span-2" disabled={pending}>Guardar dirección</Button>
          </form>
        </div>
      </Sheet>
      <Sheet open={personOpen} onOpenChange={setPersonOpen} title="Personas de contacto">
        <div className="space-y-4">
          {persons.map((p) => (
            <div key={p.id} className="flex items-start justify-between rounded-lg border p-3 text-sm">
              <button className="text-left" onClick={() => setPerson(p)}>
                <p className="font-medium">{p.name}</p>
                <p className="text-muted-foreground">{[p.position, p.email, p.phone].filter(Boolean).join(" · ")}</p>
              </button>
              <Button variant="ghost" size="icon-sm" aria-label="Eliminar persona" onClick={() => start(async () => { await deletePerson({ id: p.id!, contactId: contact.id }); router.refresh(); })}><Trash2 /></Button>
            </div>
          ))}
          <form
            className="grid gap-3 rounded-lg border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const r = await savePerson({ ...person, contactId: contact.id });
                if (!r.ok) { toast.error(r.error); return; }
                setPerson({ id: null, name: "", position: null, email: null, phone: null });
                router.refresh();
              });
            }}
          >
            <Field label="Nombre" htmlFor="p-n"><Input id="p-n" value={person.name} onChange={(e) => setPerson({ ...person, name: e.target.value })} /></Field>
            <Field label="Cargo" htmlFor="p-c"><Input id="p-c" value={person.position ?? ""} onChange={(e) => setPerson({ ...person, position: e.target.value || null })} /></Field>
            <Field label="Correo" htmlFor="p-e"><Input id="p-e" value={person.email ?? ""} onChange={(e) => setPerson({ ...person, email: e.target.value || null })} /></Field>
            <Field label="Teléfono" htmlFor="p-t"><Input id="p-t" value={person.phone ?? ""} onChange={(e) => setPerson({ ...person, phone: e.target.value || null })} /></Field>
            <Button disabled={pending}>Guardar persona</Button>
          </form>
        </div>
      </Sheet>
    </>
  );
}
