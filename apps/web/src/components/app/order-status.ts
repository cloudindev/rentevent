import type { Tone } from "@/components/ui/badge";

export const ORDER_STATUS: Record<string, { label: string; tone: Tone }> = {
  borrador: { label: "Borrador", tone: "neutral" },
  consulta: { label: "Consulta", tone: "info" },
  opcion: { label: "Opción", tone: "warning" },
  confirmado: { label: "Confirmado", tone: "success" },
  en_curso: { label: "En curso", tone: "brand" },
  devuelto: { label: "Devuelto", tone: "neutral" },
  cancelado: { label: "Cancelado", tone: "danger" },
};

/** Calendar colours per status (agenda). */
export const STATUS_COLOR: Record<string, string> = {
  borrador: "#a3a39f",
  consulta: "#2c5fb3",
  opcion: "#d08a0e",
  confirmado: "#15803d",
  en_curso: "#e5412a",
  devuelto: "#6b6b68",
  cancelado: "#b4233f",
};
