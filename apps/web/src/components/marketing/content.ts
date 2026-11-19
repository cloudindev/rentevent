import {
  Boxes, Building2, CalendarCheck, ChartColumn, Cuboid, FileText, HardHat, Landmark, PartyPopper, Ruler, Sparkles, Store, Tent, Warehouse, Heart, type LucideIcon,
} from "lucide-react";

export type ProductModule = {
  slug: string;
  name: string;
  icon: LucideIcon;
  short: string;
  headline: string;
  intro: string;
  features: { title: string; text: string }[];
  checklist: string[];
  faq: { q: string; a: string }[];
};

export const MODULES: ProductModule[] = [
  {
    slug: "configurador-carpas",
    name: "Configurador de carpas",
    icon: Tent,
    short: "Elige familia y largo; el despiece sale solo.",
    headline: "Dibuja la carpa. El despiece lo hace Rentevent.",
    intro:
      "Cada familia de carpa tiene sus reglas: pórticos, pilares, correas, lonas y lastre. Cambias el largo o un lateral y la lista de material se recalcula al momento, sin tablas fijas de medidas.",
    features: [
      { title: "Reglas por familia", text: "Fórmulas editables por tu equipo: pórticos = módulos + 1, pesos por pata, correas por tramo. Sin tocar código." },
      { title: "Tramo a tramo", text: "Techo blanco, transparente o abierto; laterales con ventana, puerta o sin lona. Cada tramo se decide por separado." },
      { title: "Suelos e interior", text: "Tarima, suelo y moqueta por m² con tramos excluidos, escenario y distribuciones de banquete, teatro o cóctel." },
      { title: "Peso, volumen y horas", text: "Kilos a cargar, camiones necesarios y horas-hombre estimadas de montaje y desmontaje." },
    ],
    checklist: ["Familias de 7, 10, 14, 15 y 20 m", "Dos aguas o poligonal", "Anclaje o pesos", "Carpas unidas con canalón", "Plantillas reutilizables"],
    faq: [
      { q: "¿Puedo usar las cantidades de mi fabricante?", a: "Sí. Un asistente inicial te pide las cantidades por pórtico y quedan como datos de tu empresa." },
      { q: "¿Y las jaimas?", a: "Son una familia más: se configuran, se unen entre sí y descuentan stock igual que una carpa." },
    ],
  },
  {
    slug: "disponibilidad",
    name: "Disponibilidad en vivo",
    icon: CalendarCheck,
    short: "Sabes si hay cerchas mientras presupuestas.",
    headline: "¿Hay material para esas fechas? Lo ves mientras escribes.",
    intro:
      "Rentevent calcula el pico de ocupación de cada artículo entre la carga y el retorno. Si faltan dos cerchas te lo dice, y también qué proyectos las tienen.",
    features: [
      { title: "Verde, ámbar o rojo", text: "Cada línea muestra cuántas unidades quedan libres y cuántas faltan." },
      { title: "Stock compartido", text: "La cercha 10/14 sirve a dos familias: reservarla para una 14 m descuenta la 10 m extra." },
      { title: "Respuesta inversa", text: "Dime unas fechas y te digo el largo máximo que puedes montar de cada familia." },
      { title: "Alternativas", text: "Otra familia, mover fechas, partir en dos carpas o pedir un subalquiler a tu proveedor." },
    ],
    checklist: ["Opciones con caducidad", "Consultas como demanda potencial", "Margen entre retorno y carga", "Sin dobles reservas: confirmación con bloqueo", "Mapa de calor de cerchas"],
    faq: [{ q: "¿Qué pasa si dos comerciales confirman a la vez?", a: "La confirmación bloquea los artículos implicados: el segundo recibe el aviso de escasez antes de guardar." }],
  },
  {
    slug: "visor-3d",
    name: "Visor 3D",
    icon: Cuboid,
    short: "El cliente ve su carpa antes de firmar.",
    headline: "Tu presupuesto, en 3D.",
    intro: "La carpa se dibuja desde la misma configuración que genera el despiece y el precio. Lo que ve el cliente es exactamente lo que vas a montar.",
    features: [
      { title: "Edición directa", text: "Haz clic en un lateral para cambiarlo a transparente; el precio y el stock se actualizan." },
      { title: "Plano acotado", text: "Vista 2D sincronizada con cotas, figura humana de referencia y plano del recinto a escala." },
      { title: "Enlace para el cliente", text: "Comparte un visor orbital de solo lectura o incrusta la imagen en el PDF." },
      { title: "Exportaciones", text: "Imagen PNG, plano PDF y modelo glTF para tu equipo técnico." },
    ],
    checklist: ["Varias carpas en la misma escena", "Detección de choques", "Banquete, teatro y cóctel", "Funciona en móvil", "Geometría instanciada a 60 fps"],
    faq: [{ q: "¿Necesito un programa de diseño?", a: "No. Todo funciona en el navegador, también en la tablet del comercial." }],
  },
  {
    slug: "presupuestos",
    name: "Presupuestos y pedidos",
    icon: FileText,
    short: "De la consulta a la firma en línea.",
    headline: "Presupuestos que se aceptan solos.",
    intro: "Tarifas por m², metro lineal, unidad o día; transporte por kilómetro; suplementos y descuentos por cliente. Envías un PDF con tu marca y el cliente firma desde el móvil.",
    features: [
      { title: "Tarifas flexibles", text: "Escalado por duración, festivos, pata alta, transparentes y pesos." },
      { title: "Margen real", text: "Coste de personal, transporte y subalquiler frente al precio, solo para quien debe verlo." },
      { title: "Versiones", text: "Cada envío queda guardado con su versión y su estado." },
      { title: "Firma en línea", text: "Aceptación con nombre y firma; el pedido pasa a confirmado y reserva el material." },
    ],
    checklist: ["PDF con imagen 3D y plano", "Anticipos", "Plantillas de correo", "Proyectos recurrentes", "Historial de cambios"],
    faq: [{ q: "¿Puedo seguir usando mi numeración?", a: "Sí, eliges el contador de pedidos y las series de facturación." }],
  },
  {
    slug: "personal",
    name: "Personal y montadores",
    icon: HardHat,
    short: "Cuadrillas, turnos y fichaje en el móvil.",
    headline: "Cada montaje, con la cuadrilla adecuada.",
    intro: "Rentevent calcula las horas de cada fase a partir del despiece y te propone a quién asignar según habilidades, disponibilidad, horas acumuladas y distancia.",
    features: [
      { title: "Tablero de turnos", text: "Vista semanal y diaria tipo Gantt con arrastrar y soltar." },
      { title: "Avisos antes de guardar", text: "Solapes, habilidades, formación caducada, descanso mínimo y horas semanales." },
      { title: "App del trabajador", text: "Agenda, dirección, plano, 3D, checklist, fotos, incidencias y firma del cliente." },
      { title: "Registro horario", text: "Fichaje con geolocalización, horas previstas frente a reales y exportación para nóminas." },
    ],
    checklist: ["Plantilla, eventuales y autónomos", "Carnés y carretilleros", "Vacaciones y bajas", "Planning por push, correo o WhatsApp", "Calendario ICS"],
    faq: [{ q: "¿Funciona sin cobertura?", a: "Sí. La app guarda partes y fichajes sin conexión y los sincroniza al volver." }],
  },
  {
    slug: "almacen",
    name: "Almacén y mantenimiento",
    icon: Warehouse,
    short: "Listas de carga, escaneo y retornos.",
    headline: "Carga lo que toca. Ni una lona menos.",
    intro: "La lista de carga sale del despiece, ordenada por ubicación. Escaneas con el móvil y al volver registras daños, pérdidas y lonas para limpiar.",
    features: [
      { title: "Escaneo QR", text: "Cada unidad seriada tiene su código e historial." },
      { title: "Retornos", text: "Recuento, daños y pérdidas; lo dañado pasa a reparación y deja de estar disponible." },
      { title: "Revisiones", text: "Revisiones periódicas de estructura y lonas con avisos de caducidad." },
      { title: "Albaranes", text: "Entrega y recogida con firma, y certificado de instalación desde plantilla." },
    ],
    checklist: ["Por preparar, cargado, en obra", "Limpieza de lonas", "Inventario cíclico", "Ubicaciones por estantería"],
    faq: [{ q: "¿Necesito lectores especiales?", a: "No, basta con la cámara del móvil." }],
  },
  {
    slug: "finanzas",
    name: "Finanzas",
    icon: Landmark,
    short: "Facturas, cobros y previsión de caja.",
    headline: "Factura el montaje el mismo día que lo desmontas.",
    intro: "Anticipos, facturas, rectificativas y series, con cobros, compras y tesorería en el mismo sitio. Preparado para Verifactu y factura electrónica.",
    features: [
      { title: "Ventas", text: "Del pedido a la factura en un clic, con anticipos descontados." },
      { title: "Compras", text: "Facturas de proveedor y coste de subalquiler imputado a cada proyecto." },
      { title: "Tesorería", text: "Cuentas, movimientos, conciliación y previsión de caja." },
      { title: "Exportación contable", text: "Ficheros listos para tu asesoría." },
    ],
    checklist: ["IVA español", "Cadena de registros para Verifactu", "Margen por proyecto", "Cobros pendientes"],
    faq: [{ q: "¿Sustituye a mi programa de contabilidad?", a: "No pretende hacerlo: exporta a él y te da el control del día a día." }],
  },
  {
    slug: "ia",
    name: "Asistente con IA",
    icon: Sparkles,
    short: "Pregunta a tus datos en lenguaje natural.",
    headline: "Pregunta qué carpa puedes montar el sábado.",
    intro: "El asistente consulta tu stock, tu agenda y tu personal. Responde en segundos y puede dejarte un borrador de pedido listo para revisar.",
    features: [
      { title: "Disponibilidad", text: "«¿Qué carpa puedo montar el 12 de diciembre?»" },
      { title: "Personal", text: "«¿Quién está libre el sábado con carné C?»" },
      { title: "Borradores", text: "Crea pedidos en borrador a partir de una conversación." },
      { title: "Workflows", text: "Automatiza avisos de escasez, caducidad de opciones y recordatorios." },
    ],
    checklist: ["Solo lee los datos de tu empresa", "Respuestas con enlaces al registro", "Historial de conversaciones"],
    faq: [{ q: "¿Mis datos entrenan modelos?", a: "No. Las consultas se usan solo para responderte." }],
  },
];

export type Solution = { slug: string; name: string; icon: LucideIcon; short: string; headline: string; intro: string; pains: string[]; modules: string[] };

export const SOLUTIONS: Solution[] = [
  { slug: "carpas", name: "Empresas de carpas", icon: Tent, short: "Despiece, cerchas y montaje", headline: "Hecho para quien vive de montar carpas.", intro: "Del pórtico al último peso: Rentevent entiende tu material y tus cuellos de botella.", pains: ["Cerchas compartidas entre familias", "Presupuestos que tardan una tarde", "Montadores sin parte de trabajo"], modules: ["configurador-carpas", "disponibilidad", "visor-3d", "personal"] },
  { slug: "eventos", name: "Productoras de eventos", icon: PartyPopper, short: "Estructuras, mobiliario y equipo", headline: "Todo el material del evento, en un pedido.", intro: "Carpas, escenarios, mobiliario y servicios con su disponibilidad y su personal.", pains: ["Subalquileres de última hora", "Varios pedidos por evento", "Márgenes que no se ven"], modules: ["presupuestos", "disponibilidad", "personal", "finanzas"] },
  { slug: "ferias", name: "Ferias y congresos", icon: Store, short: "Stands, jaimas y moqueta", headline: "Cientos de stands sin perder la cuenta.", intro: "Jaimas unidas, moqueta por m² y montajes de semanas con su planificación.", pains: ["Alquileres largos", "Moqueta y suelos por superficie", "Muchos montajes simultáneos"], modules: ["configurador-carpas", "almacen", "personal"] },
  { slug: "bodas", name: "Bodas y celebraciones", icon: Heart, short: "Carpas con encanto y en 3D", headline: "Que los novios vean su boda antes de firmar.", intro: "Laterales transparentes, banquete con plazas contadas y un visor 3D que enamora.", pains: ["Clientes que dudan sin ver", "Distribuciones de mesas", "Fines de semana saturados"], modules: ["visor-3d", "presupuestos", "disponibilidad"] },
  { slug: "ayuntamientos", name: "Ayuntamientos", icon: Building2, short: "Mercados, fiestas y eventos públicos", headline: "Mercados navideños y fiestas sin sobresaltos.", intro: "Montajes con pesos en plazas, certificados de instalación y documentación lista para el técnico municipal.", pains: ["Suelos donde no se puede anclar", "Certificados y documentación", "Fechas fijas cada año"], modules: ["configurador-carpas", "almacen", "finanzas"] },
];

export type Plan = { id: string; name: string; monthly: number | null; tagline: string; cta: string; highlight?: boolean; features: string[] };

export const PLANS: Plan[] = [
  { id: "basico", name: "Básico", monthly: 49, tagline: "Para empezar a ordenar presupuestos y stock.", cta: "Prueba gratis", features: ["Hasta 3 usuarios", "Configurador de carpas", "Disponibilidad en vivo", "Presupuestos en PDF", "Inventario y contactos"] },
  { id: "profesional", name: "Profesional", monthly: 89, tagline: "La operación completa de una empresa de carpas.", cta: "Prueba gratis", highlight: true, features: ["Usuarios ilimitados", "Todo lo de Básico", "Visor 3D y firma en línea", "Personal, turnos y fichaje", "Almacén con escaneo", "Finanzas y tesorería"] },
  { id: "empresa", name: "Empresa", monthly: null, tagline: "Varias delegaciones y necesidades a medida.", cta: "Hablar con ventas", features: ["Todo lo de Profesional", "Varias empresas y almacenes", "API y webhooks", "Asistente con IA avanzado", "Migración desde tu sistema actual", "Gestor de cuenta"] },
];

export const COMPARISON: { group: string; rows: { label: string; values: [boolean | string, boolean | string, boolean | string] }[] }[] = [
  {
    group: "Carpas y stock",
    rows: [
      { label: "Configurador paramétrico", values: [true, true, true] },
      { label: "Reglas de despiece editables", values: [true, true, true] },
      { label: "Disponibilidad en vivo", values: [true, true, true] },
      { label: "Respuesta inversa (largo máximo)", values: [false, true, true] },
      { label: "Visor 3D y plano acotado", values: [false, true, true] },
    ],
  },
  {
    group: "Operación",
    rows: [
      { label: "Usuarios", values: ["3", "Ilimitados", "Ilimitados"] },
      { label: "Tablero de turnos y fichaje", values: [false, true, true] },
      { label: "App del trabajador sin conexión", values: [false, true, true] },
      { label: "Almacén con escaneo QR", values: [false, true, true] },
    ],
  },
  {
    group: "Plataforma",
    rows: [
      { label: "Finanzas y tesorería", values: [false, true, true] },
      { label: "Asistente con IA", values: ["Básico", "Incluido", "Avanzado"] },
      { label: "API pública y webhooks", values: [false, false, true] },
      { label: "Soporte", values: ["Correo", "Correo y teléfono", "Gestor dedicado"] },
    ],
  },
];

export const ICONS = { Boxes, Ruler, ChartColumn };
