import {
  ArrowLeftRight, Boxes, Briefcase, CalendarDays, ChartColumn, HardHat, House, Landmark, LayoutDashboard, ListChecks, Mail, MapPin,
  MessageSquare, Receipt, Settings, ShoppingCart, Sparkles, Tent, Truck, Users, Warehouse, Workflow, Wrench, type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export type NavItem = { label: string; href: string; icon: LucideIcon; permission: Permission; keywords?: string };
export type NavGroup = { label: string | null; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: null,
    items: [
      { label: "Inicio", href: "/app/inicio", icon: House, permission: "ver", keywords: "panel dia" },
      { label: "Agenda", href: "/app/agenda", icon: CalendarDays, permission: "ver", keywords: "calendario" },
      { label: "Pedidos", href: "/app/pedidos", icon: ListChecks, permission: "ver", keywords: "presupuestos alquiler" },
      { label: "Proyectos", href: "/app/proyectos", icon: Briefcase, permission: "ver", keywords: "eventos" },
      { label: "Contactos", href: "/app/contactos", icon: Users, permission: "ver", keywords: "clientes proveedores" },
      { label: "Subalquileres", href: "/app/subalquileres", icon: ArrowLeftRight, permission: "ver" },
    ],
  },
  {
    label: "IA de Rentevent",
    items: [
      { label: "Preguntar al asistente", href: "/app/asistente", icon: Sparkles, permission: "ver", keywords: "ia chat" },
      { label: "Workflows", href: "/app/workflows", icon: Workflow, permission: "ver", keywords: "automatizaciones" },
      { label: "Analytics", href: "/app/analytics", icon: ChartColumn, permission: "ver", keywords: "informes" },
    ],
  },
  {
    label: "Recursos",
    items: [
      { label: "Inventario", href: "/app/inventario", icon: Boxes, permission: "ver", keywords: "articulos stock" },
      { label: "Carpas", href: "/app/carpas", icon: Tent, permission: "ver", keywords: "familias reglas despiece" },
      { label: "Personal", href: "/app/personal", icon: HardHat, permission: "ver", keywords: "montadores turnos" },
      { label: "Transporte", href: "/app/transporte", icon: Truck, permission: "ver", keywords: "vehiculos camiones" },
      { label: "Espacios", href: "/app/espacios", icon: MapPin, permission: "ver", keywords: "recintos localizaciones" },
      { label: "Almacén", href: "/app/almacen", icon: Warehouse, permission: "ver", keywords: "carga retorno escaneo" },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { label: "Dashboard", href: "/app/finanzas", icon: LayoutDashboard, permission: "finanzas" },
      { label: "Ventas", href: "/app/ventas", icon: Receipt, permission: "finanzas", keywords: "facturas" },
      { label: "Compras", href: "/app/compras", icon: ShoppingCart, permission: "finanzas", keywords: "gastos proveedores" },
      { label: "Tesorería", href: "/app/tesoreria", icon: Landmark, permission: "finanzas", keywords: "bancos caja" },
    ],
  },
  {
    label: "Otros",
    items: [
      { label: "Emails", href: "/app/emails", icon: Mail, permission: "ver", keywords: "correo bandeja" },
      { label: "Mantenimiento", href: "/app/mantenimiento", icon: Wrench, permission: "ver", keywords: "reparaciones revisiones" },
      { label: "Comunicación", href: "/app/comunicacion", icon: MessageSquare, permission: "ver", keywords: "avisos notificaciones" },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { label: "Configuración", href: "/app/configuracion", icon: Settings, permission: "ver" };
