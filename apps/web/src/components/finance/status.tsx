import { StatusPill, type Tone } from "@/components/ui/badge";

const INVOICE: Record<string, [Tone, string]> = {
  borrador: ["neutral", "Borrador"],
  emitida: ["info", "Emitida"],
  cobrada: ["success", "Cobrada"],
  vencida: ["danger", "Vencida"],
  anulada: ["neutral", "Anulada"],
};
export function InvoiceStatus({ status, draft }: { status: string; draft?: boolean }) {
  const [tone, label] = draft ? INVOICE.borrador! : INVOICE[status] ?? ["neutral", status];
  return <StatusPill tone={tone}>{label}</StatusPill>;
}

export function PurchaseStatus({ status }: { status: string }) {
  return status === "pagada" ? <StatusPill tone="success">Pagada</StatusPill> : <StatusPill tone="warning">Pendiente</StatusPill>;
}

export const PURCHASE_CATEGORIES: Record<string, string> = {
  general: "General",
  subalquiler: "Subalquiler",
  mantenimiento: "Mantenimiento",
  transporte: "Transporte",
  personal: "Personal",
  material: "Material",
  seguros: "Seguros",
  suministros: "Suministros",
};

export const PAYMENT_METHODS: Record<string, string> = {
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
  domiciliacion: "Domiciliación",
  bizum: "Bizum",
  otro: "Otro",
};

export function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: React.ReactNode; tone?: "danger" | "success" }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3.5">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular ${tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : ""}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
