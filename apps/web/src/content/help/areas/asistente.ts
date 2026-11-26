import type { HelpArea } from "../types";

export const area: HelpArea = {
  slug: "asistente",
  title: "Asistente",
  summary: "Pregunta en lenguaje natural por carpas, stock, personal, pedidos o facturación, y pide borradores de pedido.",
  overview: [
    "El asistente responde preguntas sobre tu propia empresa consultando los datos reales de Rentevent: qué carpa puedes montar en unas fechas, cuántas unidades libres hay de un artículo, quién está libre un día, qué pedidos hay en un periodo o cuánto se ha facturado en un mes.",
    "También puede crear un borrador de pedido con una carpa cuando se lo pides expresamente. El borrador no reserva material: lo revisas y completas después en Pedidos.",
    "Las respuestas incluyen enlaces a los registros consultados (artículos, pedidos, ocupación de cerchas) para que puedas abrirlos con un clic. Cada usuario tiene sus propias conversaciones, que nadie más ve.",
    "La etiqueta de la cabecera te dice en qué modo funciona: **Claude** cuando tu empresa tiene configurada la clave de IA, o **Modo simulado** cuando no. En modo simulado entiende las mismas consultas tipo, pero con frases más concretas.",
  ],
  concepts: [
    { term: "Conversación", definition: "Hilo de preguntas y respuestas. Se guarda en la columna de la izquierda con el inicio de tu primera pregunta como título." },
    { term: "Modo simulado", definition: "Funcionamiento sin clave de IA: reconoce las consultas tipo por palabras clave y usa las mismas consultas a tus datos." },
    { term: "Claude", definition: "Modo con IA completa, activo cuando hay una clave configurada. Entiende preguntas más libres y encadena varias consultas." },
    { term: "Borrador de pedido", definition: "Pedido creado por el asistente en estado borrador, sin reservar material." },
  ],
  articles: [
    {
      slug: "hacer-preguntas",
      title: "Hacer preguntas al asistente",
      summary: "Consulta disponibilidad, personal, pedidos o facturación escribiendo como hablarías con un compañero.",
      path: "/app/asistente",
      steps: [
        { title: "Abre el asistente", text: "En el menú, dentro de **IA de Rentevent**, pulsa **Preguntar al asistente**." },
        { title: "Usa una sugerencia", text: "En una conversación nueva verás ejemplos como **¿Qué carpa puedo montar del 12 al 15 de diciembre?** o **¿Quién está libre el sábado 12 de diciembre?**. Pulsa uno para lanzarlo." },
        { title: "Escribe tu pregunta", text: "Escribe en **Pregunta algo…** y pulsa Intro o el botón **Enviar**. Con Mayúsculas + Intro haces un salto de línea.", tip: "Indica siempre las fechas. Si no das año, se usa el próximo que corresponda." },
        { title: "Lee la respuesta", text: "La respuesta aparece con las cifras destacadas y, debajo, botones con enlaces a los registros consultados." },
        { title: "Sigue preguntando", text: "Puedes encadenar preguntas en la misma conversación. Con Claude activo, el asistente tiene en cuenta lo hablado antes." },
      ],
      notes: [
        "Qué puede responder: qué carpa puedes montar en unas fechas (anclada o con pesos), unidades libres de un artículo, personal sin turnos ni ausencias en un día, pedidos de un periodo y facturación emitida, cobrada y pendiente de un mes.",
        "Cada pregunta admite hasta 2.000 caracteres.",
        "El asistente respeta tus permisos: la facturación solo la consulta quien tiene permiso de Finanzas, y los borradores de pedido solo los crea quien puede gestionar pedidos.",
      ],
    },
    {
      slug: "crear-borrador-pedido",
      title: "Crear un borrador de pedido desde el asistente",
      summary: "Pide al asistente que prepare un pedido con una carpa para un cliente y una fecha.",
      path: "/app/asistente",
      roles: "Administrador, Comercial",
      steps: [
        { title: "Pídelo de forma explícita", text: "Escribe algo como «Crea un pedido de una carpa 10x20 para el 12 de diciembre para Hotel Playa Mayor». El asistente solo crea pedidos cuando se lo pides." },
        { title: "Incluye medida y fecha", text: "Indica el ancho y el largo de la carpa y la fecha del evento. Puedes añadir si la quieres de pata alta o baja.", tip: "En modo simulado, si falta la medida te pedirá el formato «una carpa 10x20»." },
        { title: "Revisa lo creado", text: "El asistente te dice la carpa y la medida finales, el cliente y las fechas de carga y retorno. El largo se ajusta a los módulos de la familia." },
        { title: "Abre el pedido", text: "Pulsa el enlace **Abrir pedido** de la respuesta y revisa la disponibilidad y el resto de datos antes de enviarlo." },
      ],
      notes: [
        "El pedido se crea como borrador y no reserva material.",
        "Si el cliente no existe en tus contactos, se crea como cliente nuevo con el nombre que indicaste.",
        "Crear pedidos requiere el permiso de pedidos, proyectos y contactos; si no lo tienes, el asistente te lo indicará.",
      ],
    },
    {
      slug: "gestionar-conversaciones",
      title: "Gestionar tus conversaciones",
      summary: "Empieza conversaciones nuevas, vuelve a las anteriores o bórralas.",
      path: "/app/asistente",
      steps: [
        { title: "Empieza de cero", text: "Pulsa **Nueva conversación** en la columna de la izquierda." },
        { title: "Retoma una anterior", text: "Pulsa cualquier conversación de la lista para ver todos sus mensajes y seguir preguntando." },
        { title: "Borra una conversación", text: "Pasa el ratón sobre ella y pulsa el icono de papelera **Borrar conversación**." },
      ],
      notes: ["La lista de conversaciones se muestra en pantallas anchas. Tus conversaciones son privadas: solo las ves tú."],
    },
    {
      slug: "modo-simulado",
      title: "Usar el asistente en modo simulado",
      summary: "Saca partido al asistente aunque tu empresa no tenga configurada la clave de IA.",
      path: "/app/asistente",
      steps: [
        { title: "Comprueba el modo", text: "Mira la etiqueta junto al título: **Modo simulado** indica que no hay clave de IA configurada." },
        { title: "Usa frases tipo", text: "Formula la pregunta como en los ejemplos: qué carpa puedo montar, quién está libre, cuántas unidades hay libres de un artículo, pedidos de un periodo o cuánto hemos facturado." },
        { title: "Pide ayuda", text: "Si no reconoce la pregunta, te responde con la lista de cosas que sabe hacer y un ejemplo de cada una." },
        { title: "Ten en cuenta las fechas por defecto", text: "Sin fechas, consulta el día de hoy; en pedidos de un periodo, los próximos 7 días." },
      ],
      notes: ["Con Claude activo, si el proveedor de IA no responde, el asistente contesta en modo simulado y lo indica al final del mensaje."],
    },
  ],
};
