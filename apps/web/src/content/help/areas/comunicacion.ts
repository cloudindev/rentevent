import type { HelpArea } from "../types";

export const area: HelpArea = {
  slug: "comunicacion",
  title: "Comunicación",
  summary: "Avisos para todo el equipo, notas internas, envío de mensajes a trabajadores y registro de todas las notificaciones enviadas.",
  overview: [
    "Comunicación es el tablón y el buzón de salida de tu equipo. Desde aquí publicas avisos generales, envías mensajes a trabajadores concretos por push, correo o WhatsApp y consultas el historial de todo lo que Rentevent ha notificado.",
    "La pestaña **Notas internas** reúne en un solo sitio las notas que se escriben en pedidos, proyectos, contactos y artículos, de la más reciente a la más antigua, con un enlace a cada registro.",
    "El **Registro de notificaciones** recoge cada aviso enviado desde cualquier parte de la aplicación: la publicación del planning, los turnos asignados, los workflows o los avisos enviados a mano. Sirve para comprobar si un mensaje llegó, se simuló o falló.",
    "Si tu empresa aún no ha configurado las claves de envío (correo, WhatsApp o push), los mensajes no salen pero quedan registrados como simulados, así puedes probar todo sin molestar a nadie.",
  ],
  concepts: [
    { term: "Aviso al equipo", definition: "Mensaje publicado en el tablón de Comunicación, visible para todos los usuarios. Puede fijarse arriba." },
    { term: "Fijar arriba", definition: "Opción que coloca un aviso al principio de la lista, marcado con una chincheta." },
    { term: "Nota interna", definition: "Comentario escrito en la ficha de un pedido, proyecto, contacto o artículo." },
    { term: "Canal", definition: "Vía de envío de una notificación: Push (app), Correo, WhatsApp o Interno." },
    { term: "Estado de la notificación", definition: "Enviada, Simulada (sin claves configuradas), Error o Sin dispositivo (push a alguien que no ha activado los avisos en su móvil)." },
  ],
  articles: [
    {
      slug: "publicar-aviso",
      title: "Publicar un aviso para todo el equipo",
      summary: "Comparte normas, cambios de nave o novedades en el tablón de avisos.",
      path: "/app/comunicacion",
      steps: [
        { title: "Abre Comunicación", text: "Entra en **Comunicación**. Se abre la pestaña **Avisos al equipo**." },
        { title: "Crea el aviso", text: "Pulsa **Nuevo aviso** en la cabecera." },
        { title: "Escribe el contenido", text: "Rellena **Título** y **Mensaje**.", tip: "El título necesita al menos 2 caracteres y el mensaje puede tener hasta 4.000." },
        { title: "Fíjalo si es importante", text: "Activa **Fijar arriba** para que aparezca el primero, con una chincheta." },
        { title: "Publica", text: "Pulsa **Publicar**. El aviso aparece en la lista con tu nombre y la fecha." },
        { title: "Edita o borra", text: "Usa los iconos **Editar aviso** y **Eliminar aviso** de cada aviso. Al borrar te pedirá confirmación." },
      ],
      notes: [
        "Un aviso del tablón no envía notificaciones a los móviles. Para avisar directamente a personas concretas usa **Enviar aviso**.",
        "Publican, editan y borran avisos los administradores, comerciales, jefes de almacén y jefes de equipo. El rol Solo lectura puede leerlos pero no ve **Nuevo aviso** ni los iconos de editar y borrar.",
      ],
    },
    {
      slug: "enviar-aviso-trabajadores",
      title: "Enviar un mensaje a trabajadores",
      summary: "Avisa a una o varias personas del equipo por push, correo, WhatsApp o internamente.",
      path: "/app/comunicacion",
      roles: "Administrador, Jefe de equipo",
      steps: [
        { title: "Abre la pestaña", text: "En **Comunicación**, pulsa la pestaña **Enviar aviso**." },
        { title: "Escribe el mensaje", text: "Rellena **Título** y **Mensaje**, por ejemplo un cambio de hora de carga." },
        { title: "Elige los canales", text: "En **Canales** marca **Push (app)**, **Correo**, **WhatsApp** o **Interno**. Puedes marcar varios." },
        { title: "Elige los destinatarios", text: "En la lista de la derecha marca a cada persona o usa **Todo el equipo**. Solo aparecen los trabajadores activos; quien no tiene correo lleva la etiqueta **sin correo**." },
        { title: "Publícalo también en el tablón", text: "Si quieres que quede a la vista de todos, activa **Publicar también como aviso fijado**." },
        { title: "Envía", text: "Pulsa **Enviar a** seguido del número de personas. Verás cuántos envíos se han registrado y cuántos se saltaron por falta de datos de contacto, y pasarás al **Registro de notificaciones**.", tip: "Debes elegir al menos un canal y un destinatario. El correo usa el email de la ficha y WhatsApp su teléfono." },
      ],
      notes: [
        "Sin claves configuradas, el envío queda registrado como simulado.",
        "El push solo llega a quien tiene la ficha vinculada a un usuario y ha activado los avisos en su móvil desde el Perfil de la app.",
      ],
    },
    {
      slug: "notas-internas",
      title: "Consultar las notas internas",
      summary: "Revisa en un solo listado las notas de pedidos, proyectos, contactos y artículos.",
      path: "/app/comunicacion",
      steps: [
        { title: "Abre la pestaña", text: "En **Comunicación**, pulsa **Notas internas**." },
        { title: "Lee el listado", text: "Cada nota muestra el autor, la fecha y el tipo de registro al que pertenece: **Pedido**, **Proyecto**, **Contacto** o **Artículo**." },
        { title: "Ve al registro", text: "Pulsa el tipo de registro para abrir la ficha donde se escribió la nota." },
      ],
      notes: ["Las notas se escriben desde cada ficha; aquí solo se consultan. Se muestran las 150 más recientes."],
    },
    {
      slug: "registro-notificaciones",
      title: "Comprobar si una notificación se envió",
      summary: "Consulta el historial de notificaciones y filtra por canal o estado.",
      path: "/app/comunicacion",
      steps: [
        { title: "Abre el registro", text: "En **Comunicación**, pulsa **Registro de notificaciones**." },
        { title: "Filtra por canal", text: "Pulsa **Todos los canales**, **Push**, **Correo**, **WhatsApp** o **Interno**." },
        { title: "Filtra por estado", text: "Pulsa **Todos los estados**, **Enviada**, **Simulada**, **Error** o **Sin dispositivo**. Los dos filtros se combinan." },
        { title: "Revisa cada envío", text: "La tabla muestra **Fecha**, **Canal**, **Destinatario**, **Mensaje** y **Estado**. Si el aviso trata de un pedido, proyecto, contacto o artículo, hay un enlace para abrirlo." },
        { title: "Interpreta el estado", text: "**Simulada** significa que faltan las claves de ese canal; **Error** que el proveedor lo rechazó; **Sin dispositivo** que la persona no tiene los avisos push activados en ningún móvil." },
      ],
      notes: ["Se muestran las 300 notificaciones más recientes que cumplen el filtro."],
    },
  ],
};
