import { PageBody } from "@/components/app/page-header";
import { StatusPill } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { serviceModes } from "@/lib/env";
import { requireApp } from "@/server/context";

export const metadata = { title: "Integraciones" };

const HOW: Record<string, string> = {
  Correo: "SMTP_URL, EMAIL_FROM",
  Almacenamiento: "S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY",
  Pagos: "STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_*",
  "Google OAuth": "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET",
  "Microsoft OAuth": "MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET",
  Mapas: "GEOCODER_URL (compatible con Nominatim)",
  WhatsApp: "WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID",
  "Asistente IA": "ANTHROPIC_API_KEY, AI_MODEL",
  "Notificaciones push": "VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY",
  "Cola de trabajos": "REDIS_URL (sin ella: cola en PostgreSQL)",
};
const SIM: Record<string, string> = {
  Correo: "Los correos se guardan en el buzón de pruebas",
  Almacenamiento: "Los archivos se guardan en PostgreSQL",
  Pagos: "El cambio de plan se activa sin cobro",
  "Google OAuth": "Botón desactivado",
  "Microsoft OAuth": "Botón desactivado",
  Mapas: "Nomenclátor interno de poblaciones",
  WhatsApp: "Se registra el envío sin mandarlo",
  "Asistente IA": "Asistente basado en reglas",
  "Notificaciones push": "Se registra el envío sin mandarlo",
  "Cola de trabajos": "Trabajos en PostgreSQL procesados por el cron",
};

export default async function IntegrationsPage() {
  await requireApp("configuracion");
  const modes = serviceModes();
  return (
    <PageBody className="max-w-5xl">
      <p className="text-sm text-muted-foreground">Todos los servicios externos tienen un modo simulado para que Rentevent funcione sin claves. Configura las variables de entorno del despliegue para activarlos.</p>
      <Table>
        <THead><TR><TH>Servicio</TH><TH>Modo</TH><TH>En modo simulado</TH><TH>Variables</TH></TR></THead>
        <TBody>
          {Object.entries(modes).map(([k, m]) => (
            <TR key={k}>
              <TD className="font-medium">{k}</TD>
              <TD><StatusPill tone={m === "real" ? "success" : "warning"}>{m === "real" ? "Conectado" : "Simulado"}</StatusPill></TD>
              <TD className="text-muted-foreground">{m === "real" ? "—" : SIM[k]}</TD>
              <TD><code className="text-xs">{HOW[k]}</code></TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </PageBody>
  );
}
