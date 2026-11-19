import type { Metadata } from "next";
import { CalendarCheck, Mail, MapPin } from "lucide-react";
import { ContactForm } from "@/components/marketing/contact-form";
import { CheckList, Container } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Contacto y demo",
  description: "Solicita una demostración de Rentevent con tus propias carpas o escríbenos.",
  alternates: { canonical: "/contacto" },
};

export default function ContactPage() {
  return (
    <section className="py-14 sm:py-20">
      <Container className="grid gap-12 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-brand-700">Contacto</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">Te lo enseñamos con tus carpas</h1>
          <p className="mt-5 text-lg text-muted-foreground">En 30 minutos configuramos una de tus familias, cargamos tu stock de cerchas y presupuestamos un evento real.</p>
          <CheckList className="mt-8" items={["Demo por videollamada o en tu nave", "Sin compromiso", "Respuesta en un día laborable"]} />
          <dl className="mt-10 space-y-4 text-sm">
            <div className="flex items-center gap-3">
              <Mail className="size-4 text-muted-foreground" aria-hidden />
              <dt className="sr-only">Correo</dt>
              <dd>
                <a href="mailto:ventas@rentevent.es" className="text-link hover:underline">
                  ventas@rentevent.es
                </a>
              </dd>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="size-4 text-muted-foreground" aria-hidden />
              <dt className="sr-only">Ubicación</dt>
              <dd>Asturias, España</dd>
            </div>
            <div className="flex items-center gap-3">
              <CalendarCheck className="size-4 text-muted-foreground" aria-hidden />
              <dt className="sr-only">Horario</dt>
              <dd>Lunes a viernes, de 8:00 a 18:00</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-3xl border p-6 sm:p-8">
          <ContactForm />
        </div>
      </Container>
    </section>
  );
}
