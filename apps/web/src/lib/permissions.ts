import type { Role } from "@rentevent/db/schema";

export const ROLE_LABELS: Record<Role, string> = {
  administrador: "Administrador",
  comercial: "Comercial",
  jefe_almacen: "Jefe de almacén",
  jefe_equipo: "Jefe de equipo",
  montador: "Montador",
  solo_lectura: "Solo lectura",
};

export const PERMISSIONS = [
  "ver",
  "comercial",
  "confirmar",
  "ver_margen",
  "ver_costes",
  "finanzas",
  "inventario",
  "carpas",
  "almacen",
  "mantenimiento",
  "personal",
  "fichar",
  "transporte",
  "configuracion",
  "usuarios",
  "automatizaciones",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<Permission, string> = {
  ver: "Ver datos",
  comercial: "Pedidos, proyectos y contactos",
  confirmar: "Confirmar pedidos",
  ver_margen: "Ver márgenes",
  ver_costes: "Ver costes de personal",
  finanzas: "Finanzas",
  inventario: "Inventario",
  carpas: "Familias y reglas de carpa",
  almacen: "Almacén",
  mantenimiento: "Mantenimiento",
  personal: "Planificación de personal",
  fichar: "Fichaje y partes",
  transporte: "Transporte",
  configuracion: "Configuración",
  usuarios: "Usuarios y roles",
  automatizaciones: "Workflows",
};

const ALL = new Set<Permission>(PERMISSIONS);
export const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  administrador: ALL,
  comercial: new Set(["ver", "comercial", "confirmar", "ver_margen", "carpas", "transporte", "automatizaciones"]),
  jefe_almacen: new Set(["ver", "inventario", "almacen", "mantenimiento", "transporte", "carpas"]),
  jefe_equipo: new Set(["ver", "personal", "fichar", "transporte", "almacen"]),
  montador: new Set(["fichar"]),
  solo_lectura: new Set(["ver"]),
};

export function can(role: string, p: Permission): boolean {
  return ROLE_PERMISSIONS[role as Role]?.has(p) ?? false;
}

/** The team notice board (Comunicación → Avisos): anyone who plans or runs operations, not read-only users. */
/** Everyone who works on projects (not Solo lectura or Montador): announcements, project tasks. */
export const canCollaborate = (role: string) => can(role, "personal") || can(role, "comercial") || can(role, "almacen");
export const canManageAnnouncements = canCollaborate;

/** Field-level visibility; tenant overrides in settings.fieldPermissions[role][field]. */
export const SENSITIVE_FIELDS = { margen: "ver_margen", coste: "ver_margen", coste_hora: "ver_costes" } as const;
export function canSeeField(role: string, field: keyof typeof SENSITIVE_FIELDS, overrides?: Record<string, Record<string, boolean>>): boolean {
  const o = overrides?.[role]?.[field];
  if (typeof o === "boolean") return o;
  return can(role, SENSITIVE_FIELDS[field]);
}
