export type PlanId = "basico" | "profesional" | "empresa";

export const PLANS: { id: PlanId; name: string; pricePerUser: number | null; description: string; seats: number; modules: string[]; features: string[] }[] = [
  { id: "basico", name: "Básico", pricePerUser: 49, description: "Para empresas pequeñas que empiezan a ordenar su stock.", seats: 3, modules: ["carpas", "pedidos", "inventario"], features: ["Configurador de carpas y despiece", "Disponibilidad en tiempo real", "Presupuestos en PDF", "Hasta 3 usuarios"] },
  { id: "profesional", name: "Profesional", pricePerUser: 89, description: "Todo el día a día de una empresa de carpas en un sitio.", seats: 15, modules: ["carpas", "pedidos", "inventario", "personal", "almacen", "finanzas", "3d"], features: ["Todo lo del Básico", "Visor 3D y firma en línea", "Planificación de montadores y app", "Almacén con escaneo QR", "Facturación y tesorería"] },
  { id: "empresa", name: "Empresa", pricePerUser: null, description: "Varias delegaciones, API e integraciones a medida.", seats: 100, modules: ["carpas", "pedidos", "inventario", "personal", "almacen", "finanzas", "3d", "ia", "api"], features: ["Todo lo del Profesional", "Asistente IA y workflows", "API pública y webhooks", "Soporte prioritario y SLA"] },
];

export const planById = (id: string) => PLANS.find((p) => p.id === id) ?? null;

export function monthlyCost(plan: PlanId, seats: number, annual: boolean) {
  const p = planById(plan);
  if (!p?.pricePerUser) return null;
  const m = p.pricePerUser * seats;
  return annual ? Math.round(m * 0.8 * 100) / 100 : m;
}
