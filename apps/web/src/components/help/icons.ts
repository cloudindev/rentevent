import { ArrowLeftRight, Boxes, Briefcase, ChartColumn, HardHat, House, Landmark, ListChecks, Mail, MapPin, MessageSquare, Rocket, Settings, Sparkles, Tent, Truck, Users, Warehouse, Workflow, Wrench, type LucideIcon } from "lucide-react";

export const HELP_ICONS: Record<string, LucideIcon> = {
  "primeros-pasos": Rocket,
  inicio: House,
  pedidos: ListChecks,
  proyectos: Briefcase,
  contactos: Users,
  subalquileres: ArrowLeftRight,
  carpas: Tent,
  inventario: Boxes,
  almacen: Warehouse,
  mantenimiento: Wrench,
  transporte: Truck,
  espacios: MapPin,
  personal: HardHat,
  comunicacion: MessageSquare,
  emails: Mail,
  finanzas: Landmark,
  asistente: Sparkles,
  workflows: Workflow,
  analytics: ChartColumn,
  configuracion: Settings,
};
