import type { HelpArea } from "../types";

export const area: HelpArea = {
  slug: "transporte",
  title: "Transporte",
  summary: "Flota de vehículos y rutas del día: qué vehículo lleva cada carga, si cabe y quién conduce.",
  overview: [
    "Transporte reúne tu flota y las rutas de cada día. En **Vehículos** registras camiones, furgonetas, tráileres, remolques y camiones grúa con su carga útil, su volumen, el carné que exigen y la fecha de la ITV.",
    "En **Rutas del día** aparecen los turnos de carga, transporte y retorno de los proyectos. Esos turnos se generan desde cada proyecto y la cuadrilla se asigna en el tablero de Personal; aquí eliges qué vehículo hace cada viaje.",
    "Al asignar un vehículo, la app compara el peso y el volumen de las carpas del pedido con la capacidad del vehículo y comprueba si en la cuadrilla hay alguien con el carné necesario.",
  ],
  concepts: [
    { term: "Vehículo", definition: "Camión, furgoneta, tráiler, remolque o camión grúa de tu flota." },
    { term: "Carga útil", definition: "Peso máximo en kg que puede llevar el vehículo." },
    { term: "Carné necesario", definition: "Permiso de conducir que exige el vehículo: B, C o C+E." },
    { term: "Activo", definition: "Solo los vehículos activos se pueden asignar a las rutas." },
    { term: "Carga, Transporte, Retorno", definition: "Fases de un proyecto que generan turnos y aparecen en las rutas del día." },
    { term: "Acceso", definition: "Vehículo máximo que admite el espacio del evento, según su ficha en Espacios." },
  ],
  articles: [
    {
      slug: "alta-vehiculo",
      title: "Dar de alta o editar un vehículo",
      summary: "Registra un vehículo con su capacidad, carné e ITV.",
      path: "/app/transporte?tab=vehiculos",
      roles: "Administrador, Comercial, Jefe de almacén, Jefe de equipo",
      steps: [
        { title: "Abre Vehículos", text: "Entra en **Transporte** desde el menú lateral y pulsa la pestaña **Vehículos**." },
        { title: "Crea o edita", text: "Pulsa **Nuevo vehículo** (o **Añadir vehículo** si aún no tienes ninguno). Para cambiar uno, pulsa **Editar** en su fila." },
        { title: "Identifícalo", text: "Escribe el **Nombre** (por ejemplo «Camión grúa 12 t»), la **Matrícula** y elige el **Tipo**: **Camión**, **Furgoneta**, **Tráiler**, **Remolque** o **Camión grúa**." },
        { title: "Indica la capacidad", text: "Rellena **Carga útil (kg)** y **Volumen (m³)**. Son obligatorios y se usan para avisar si una carga no cabe." },
        { title: "Carné e ITV", text: "Elige el **Carné necesario** (B, C o C+E) y la fecha de **ITV hasta**." },
        { title: "Coste y estado", text: "Escribe el **Coste por km (€)** y deja **Activo** encendido si el vehículo está en servicio." },
        { title: "Guarda", text: "Pulsa **Guardar**.", tip: "En la tabla, la ITV aparece en ámbar si vence en los próximos 30 días y en rojo si ya ha vencido." },
      ],
      notes: ["Si un vehículo deja de estar en servicio, apaga **Activo**: deja de salir en el desplegable de las rutas y conservas sus datos."],
    },
    {
      slug: "rutas-del-dia",
      title: "Consultar las rutas del día",
      summary: "Mira qué cargas, transportes y retornos hay un día concreto.",
      path: "/app/transporte",
      steps: [
        { title: "Abre Transporte", text: "Entra en **Transporte**. Se abre **Rutas del día** con los turnos de hoy." },
        { title: "Cambia de día", text: "Usa las flechas **‹** y **›**, elige una fecha en el calendario o pulsa **Hoy** para volver al día actual." },
        { title: "Lee cada viaje", text: "Cada tarjeta muestra el horario, la fase (**Carga**, **Transporte** o **Retorno**), el proyecto, el destino y el pedido. En las cargas el destino es **Nave**." },
        { title: "Abre la ruta", text: "Si el destino tiene coordenadas, pulsa **Ruta** para abrir el trayecto en Google Maps." },
        { title: "Revisa el acceso", text: "Si el espacio limita el tamaño del vehículo, verás **Acceso** con el vehículo máximo admitido." },
        { title: "Mira la cuadrilla", text: "Abajo a la derecha verás la **Cuadrilla** asignada al turno o **Sin cuadrilla**." },
      ],
      notes: ["Los turnos de transporte se generan desde cada proyecto y la cuadrilla se asigna en el tablero de Personal."],
    },
    {
      slug: "asignar-vehiculo",
      title: "Asignar un vehículo a un viaje",
      summary: "Elige el vehículo de cada turno y comprueba capacidad y conductor.",
      path: "/app/transporte",
      roles: "Administrador, Comercial, Jefe de almacén, Jefe de equipo",
      steps: [
        { title: "Busca el viaje", text: "En **Rutas del día** ve al día y localiza la tarjeta del turno." },
        { title: "Elige el vehículo", text: "En el desplegable de la tarjeta elige el vehículo (solo salen los activos) o **Sin vehículo** para quitarlo. Se guarda al momento." },
        { title: "Comprueba la carga", text: "Si el pedido tiene carpas configuradas, verás el peso y el volumen de la carga frente a la capacidad del vehículo.", tip: "Si no cabe, el texto se pone en rojo y verás **Supera la capacidad** con cuántos viajes harían falta, o la opción de usar un vehículo mayor." },
        { title: "Comprueba el conductor", text: "En transportes y retornos, la app busca en la cuadrilla a alguien con el carné del vehículo. Verás **Conductor** con su nombre o el aviso **Falta conductor con** el carné necesario.", tip: "Para vehículos de carné C también vale un conductor con C+E." },
      ],
      notes: ["El vehículo asignado también se ve en el tablero de Personal."],
    },
  ],
};
