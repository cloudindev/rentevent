import type { HelpArea } from "../types";

export const area: HelpArea = {
  slug: "analytics",
  title: "Analytics",
  summary: "Informes de ocupación de carpas, ingresos, clientes, rentabilidad por proyecto y horas de personal, con exportación a CSV.",
  overview: [
    "Analytics reúne en una página los indicadores principales del negocio para el periodo que elijas: cuánto se ha facturado, qué ocupación han tenido las cerchas de cada familia de carpa, qué clientes facturan más, qué margen deja cada proyecto y cuántas horas ha trabajado el equipo frente a las planificadas.",
    "Los datos salen de otras áreas: las facturas de Ventas, las reservas de material de los pedidos, los costes de subalquileres, compras y líneas de pedido, y los turnos y fichajes de Personal. No hay que preparar nada: basta con trabajar con normalidad en la aplicación.",
    "Cada bloque tiene su propio botón **CSV** para descargar los datos y seguir trabajando con ellos en una hoja de cálculo.",
  ],
  concepts: [
    { term: "Periodo", definition: "Rango de fechas Desde y Hasta que se aplica a todos los informes. Por defecto, desde el primer día de hace 11 meses hasta el final del mes que viene." },
    { term: "Facturado (base)", definition: "Suma de la base imponible de las facturas emitidas, cobradas o vencidas, sin IVA." },
    { term: "Ocupación de cerchas", definition: "Media mensual de cerchas reservadas (pedidos confirmados y opciones) sobre el stock utilizable de cada familia." },
    { term: "Ingreso facturado o presupuestado", definition: "En rentabilidad, el ingreso de un proyecto es lo facturado; si aún no hay factura, el último presupuesto de sus pedidos sin IVA." },
    { term: "Coste estimado", definition: "Material, subalquileres, compras del proyecto y horas fichadas en sus turnos por el coste por hora de cada trabajador." },
  ],
  articles: [
    {
      slug: "elegir-periodo",
      title: "Elegir el periodo de los informes",
      summary: "Ajusta las fechas para ver los indicadores del rango que te interesa.",
      path: "/app/analytics",
      steps: [
        { title: "Abre Analytics", text: "En el menú, dentro de **IA de Rentevent**, pulsa **Analytics**." },
        { title: "Indica las fechas", text: "En la cabecera rellena la fecha inicial y la final.", tip: "Si pones la fecha final antes que la inicial, Rentevent las intercambia." },
        { title: "Aplica", text: "Pulsa **Aplicar**. Todos los bloques de la página se recalculan con ese periodo." },
        { title: "Lee los totales", text: "Arriba tienes cuatro cifras: **Facturado (base)**, **Ocupación media de cerchas**, **Horas planificadas** y **Horas fichadas**." },
      ],
      notes: ["**Facturado (base)**, **Ingresos por mes** y **Clientes principales** solo se muestran a quien tiene permiso de Finanzas. **Rentabilidad por proyecto** se muestra con permiso de Finanzas o de ver márgenes."],
    },
    {
      slug: "ocupacion-carpas",
      title: "Analizar la ocupación por familia de carpa",
      summary: "Detecta en qué meses y familias se queda corto el material crítico.",
      path: "/app/analytics",
      steps: [
        { title: "Busca el bloque", text: "Baja hasta **Ocupación por familia de carpa**. Cada fila es una familia con su cercha y cada columna un mes." },
        { title: "Lee los colores", text: "Cada casilla muestra el porcentaje medio de ocupación del mes: en verde por debajo del 60 %, en amarillo desde el 60 % y en rojo desde el 85 %." },
        { title: "Saca conclusiones", text: "Los meses en rojo indican que casi todas las cerchas de esa familia estaban reservadas: es donde conviene subalquilar o ampliar stock." },
      ],
      notes: ["Cuentan las reservas de pedidos confirmados y en opción. Las unidades en reparación no forman parte del stock utilizable."],
    },
    {
      slug: "ingresos-clientes",
      title: "Revisar ingresos y clientes principales",
      summary: "Compara lo facturado con lo cobrado mes a mes y descubre qué clientes pesan más.",
      path: "/app/analytics",
      steps: [
        { title: "Mira los ingresos por mes", text: "En **Ingresos por mes** cada mes tiene dos barras: **Facturado (base)** y **Cobrado**. Pasa el ratón por encima para ver las cifras." },
        { title: "Revisa los clientes", text: "En **Clientes principales** ves los diez clientes con más base facturada en el periodo." },
        { title: "Exporta si lo necesitas", text: "Pulsa **CSV** en cada bloque. La exportación de clientes incluye hasta 100 clientes con su número de facturas." },
      ],
      notes: [
        "Solo cuentan las facturas emitidas, cobradas o vencidas, según su fecha de emisión.",
        "Estos bloques y sus exportaciones requieren el permiso de Finanzas.",
      ],
    },
    {
      slug: "rentabilidad-proyectos",
      title: "Consultar la rentabilidad por proyecto",
      summary: "Compara el ingreso de cada proyecto con su coste estimado y su margen.",
      path: "/app/analytics",
      steps: [
        { title: "Busca el bloque", text: "Baja hasta **Rentabilidad por proyecto**. Aparecen los proyectos cuyas fechas caen en el periodo, ordenados por ingreso." },
        { title: "Lee el ingreso", text: "La columna **Ingreso** indica debajo si el importe está **facturado** o **presupuestado**." },
        { title: "Revisa coste y margen", text: "Las columnas **Coste** y **Margen** muestran el coste estimado y el margen en euros y en porcentaje.", tip: "El margen sale en verde desde el 40 %, en amarillo entre el 20 % y el 40 % y en rojo por debajo del 20 %." },
        { title: "Abre el proyecto", text: "Pulsa el nombre del proyecto para ir a su ficha." },
      ],
      notes: [
        "El bloque solo aparece a quien tiene permiso de Finanzas o de ver márgenes.",
        "Las columnas **Coste** y **Margen** solo se muestran a quien tiene permiso para ver márgenes; la exportación CSV también las omite en ese caso.",
        "El coste de personal solo incluye las horas fichadas en turnos del proyecto y con salida registrada.",
      ],
    },
    {
      slug: "horas-personal",
      title: "Comparar horas planificadas y fichadas",
      summary: "Detecta desviaciones entre lo que se planificó en el tablero y lo que se fichó.",
      path: "/app/analytics",
      steps: [
        { title: "Busca el bloque", text: "Baja hasta **Horas de personal**. Aparece cada trabajador activo con turnos o fichajes en el periodo." },
        { title: "Lee las columnas", text: "Tienes **Tipo** (Plantilla, Eventual o Autónomo), **Planificadas** (turnos asignados que el trabajador no ha rechazado, igual que en Fichajes), **Fichadas** y **Diferencia**." },
        { title: "Busca desviaciones", text: "Una diferencia positiva, en amarillo, indica que se ha fichado más de lo planificado. Revisa esos casos en **Personal** > **Fichajes**." },
      ],
      notes: ["Solo cuentan los fichajes con salida registrada, descontando la pausa."],
    },
    {
      slug: "exportar-csv",
      title: "Exportar los informes a CSV",
      summary: "Descarga los datos de cada bloque para trabajarlos en Excel u otra hoja de cálculo.",
      path: "/app/analytics",
      steps: [
        { title: "Elige el periodo", text: "Ajusta las fechas y pulsa **Aplicar**. La exportación usa ese mismo periodo." },
        { title: "Descarga el bloque", text: "Pulsa **CSV** en la cabecera del bloque que quieras: ocupación, ingresos, clientes, rentabilidad o horas." },
        { title: "Ábrelo", text: "El archivo se llama analytics, seguido del bloque y las fechas. Usa punto y coma como separador y coma decimal, listo para Excel en español." },
      ],
    },
  ],
};
