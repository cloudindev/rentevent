import type { HelpArea } from "../types";

export const area: HelpArea = {
  slug: "finanzas",
  title: "Finanzas",
  summary: "Factura tus pedidos, registra cobros y compras, concilia el banco y controla la caja y el margen por proyecto.",
  overview: [
    "El grupo Finanzas de la barra lateral reúne cuatro secciones: Dashboard (la foto financiera del momento), Ventas (facturas, anticipos, rectificativas y cobros), Compras (facturas de proveedor, gastos y tickets) y Tesorería (cuentas bancarias, movimientos, conciliación y previsión de caja).",
    "Las facturas nacen normalmente de un pedido: se crean como borrador con las líneas facturables del pedido, las revisas y las emites. Al emitir, la factura recibe el siguiente número de su serie, la fecha de hoy y una huella encadenada preparada para Verifactu. A partir de ahí ya no se puede modificar: cualquier corrección se hace con una rectificativa.",
    "Las compras que imputas a un proyecto, los subalquileres y las horas fichadas alimentan el margen por proyecto del Dashboard. Los cobros y pagos que registras pueden crear automáticamente su movimiento bancario conciliado en Tesorería, y al revés: desde un movimiento del extracto puedes asignar el cobro de una factura o el pago de una compra.",
    "Con los permisos estándar, todo el grupo Finanzas es exclusivo del Administrador.",
  ],
  concepts: [
    { term: "Borrador", definition: "Factura sin número todavía. Se puede editar y borrar sin romper la numeración." },
    { term: "Emitida", definition: "Factura con número y fecha asignados, pendiente de cobro. Ya no se puede modificar." },
    { term: "Vencida", definition: "Factura emitida que ha pasado su fecha de vencimiento sin cobrarse del todo. El cambio es automático." },
    { term: "Cobrada", definition: "Factura cuyo importe cobrado cubre el total." },
    { term: "Anulada", definition: "Factura anulada por una rectificativa emitida por el importe total." },
    { term: "Anticipo", definition: "Factura por un porcentaje del pedido. Se descuenta automáticamente en la factura final del mismo pedido." },
    { term: "Rectificativa", definition: "Factura de la serie R que corrige o anula una factura emitida, con importes en negativo." },
    { term: "Serie", definition: "Numeración correlativa por año. Por defecto, F para facturas, A para anticipos y R para rectificativas; puedes crear series propias y elegirlas en el borrador." },
    { term: "Huella", definition: "Código del registro Verifactu de cada factura emitida, encadenado con la huella de la factura anterior." },
    { term: "Conciliar", definition: "Vincular un movimiento bancario con el cobro de una factura, el pago de una compra o una categoría." },
    { term: "Previsto", definition: "Movimiento con fecha futura que solo cuenta para la previsión de caja." },
  ],
  articles: [
    {
      slug: "dashboard-financiero",
      title: "Leer el Dashboard financiero",
      summary: "Entiende de un vistazo la facturación, los cobros pendientes, la caja prevista y la rentabilidad de cada proyecto.",
      path: "/app/finanzas",
      roles: "Administrador",
      steps: [
        {
          title: "Revisa los indicadores",
          text: "Arriba tienes **Facturado este mes** (base imponible, comparada con el mismo periodo del mes anterior), **Cobros pendientes**, **Vencido** y **Caja prevista a 30 días**.",
          tip: "Pulsa el texto bajo Cobros pendientes o Vencido para abrir Ventas filtrado por ese estado.",
        },
        {
          title: "Mira la facturación mensual",
          text: "El gráfico **Facturación mensual** muestra la base imponible de las facturas emitidas en los últimos 12 meses y el total del año en curso.",
        },
        {
          title: "Consulta la previsión de caja",
          text: "**Previsión de caja** dibuja el saldo de los próximos 30 días. Pulsa **Tesorería** para ver el detalle a 90 días.",
        },
        {
          title: "Analiza el margen por proyecto",
          text: "La tabla **Margen por proyecto** compara el **Ingreso** con los costes de **Material y servicios**, **Subalquiler**, **Compras** y **Personal**, y calcula el **Margen** y el %.",
          tip: "Si un proyecto aún no está facturado, el ingreso es el del presupuesto aceptado y aparece marcado como pres. Los márgenes por debajo del 20 % se destacan.",
        },
        {
          title: "Abre un proyecto",
          text: "Pulsa el nombre de un proyecto para ir a su ficha.",
        },
      ],
      notes: ["Las columnas de costes y margen solo se muestran a los roles autorizados a ver márgenes (ver Permisos por campo en Configuración)."],
    },
    {
      slug: "facturar-pedido",
      title: "Crear una factura desde un pedido",
      summary: "Genera un borrador con las líneas facturables de un pedido, listo para revisar y emitir.",
      path: "/app/ventas",
      roles: "Administrador",
      steps: [
        {
          title: "Abre el diálogo de nueva factura",
          text: "En **Ventas** pulsa **Nueva factura**. Se abre en la pestaña **Desde un pedido**.",
          tip: "También puedes facturar desde la ficha del pedido con el botón **Facturar** del panel de presupuestos.",
        },
        {
          title: "Elige el pedido",
          text: "Selecciona el **Pedido** en la lista. Aparecen los pedidos en opción, confirmados, en curso o devueltos, con su número, título y cliente.",
        },
        {
          title: "Elige el tipo",
          text: "En **Tipo** deja **Factura final** para facturar el pedido completo.",
          tip: "Los anticipos ya emitidos de ese pedido se descuentan automáticamente en la factura final.",
        },
        {
          title: "Crea el borrador",
          text: "Pulsa **Crear borrador**. Se abrirá la factura en estado **Borrador** con las líneas del pedido.",
        },
        {
          title: "Revisa las líneas",
          text: "Comprueba conceptos, cantidades, precios, descuentos e IVA. Las líneas de texto, las incluidas en el precio y las de despiece de carpa no se facturan por separado.",
          tip: "Los artículos por día incluyen los días del evento en el concepto, y el descuento global del pedido se combina con el de cada línea.",
        },
      ],
    },
    {
      slug: "facturar-anticipo",
      title: "Facturar un anticipo",
      summary: "Cobra por adelantado un porcentaje del pedido y descuéntalo después en la factura final.",
      path: "/app/ventas",
      roles: "Administrador",
      steps: [
        {
          title: "Abre Nueva factura",
          text: "En **Ventas** pulsa **Nueva factura** y quédate en **Desde un pedido**.",
        },
        {
          title: "Elige el pedido y el tipo",
          text: "Selecciona el **Pedido** y en **Tipo** elige **Anticipo**.",
        },
        {
          title: "Indica el porcentaje",
          text: "Escribe el **Porcentaje** a facturar (por defecto 30). Se calcula sobre la base del pedido, respetando cada tipo de IVA.",
          tip: "Desde la ficha del pedido, el botón **Anticipo 30 %** crea directamente el borrador con ese porcentaje.",
        },
        {
          title: "Crea y emite",
          text: "Pulsa **Crear borrador**, revísalo y emítelo. Los anticipos usan su propia serie (A) y se ven en la pestaña **Anticipos** de Ventas.",
        },
        {
          title: "Factura el resto",
          text: "Cuando hagas la **Factura final** del mismo pedido, se añadirán líneas que descuentan los anticipos emitidos.",
          tip: "Solo se descuentan los anticipos ya emitidos, no los que siguen en borrador.",
        },
      ],
    },
    {
      slug: "factura-en-blanco",
      title: "Crear y editar una factura en blanco",
      summary: "Factura conceptos que no salen de un pedido y edita cualquier borrador.",
      path: "/app/ventas",
      roles: "Administrador",
      steps: [
        {
          title: "Crea el borrador",
          text: "En **Ventas** pulsa **Nueva factura**, cambia a la pestaña **En blanco**, elige el **Cliente** (o **Elegir después**) y pulsa **Crear borrador**.",
        },
        {
          title: "Elige cliente y vencimiento",
          text: "En la tarjeta **Borrador** elige el **Cliente**; la lista indica cuáles no tienen NIF. Deja **Vencimiento** vacío para usar las condiciones de pago del cliente.",
          tip: "Si has creado series propias, aparece también **Serie**: elige con qué serie se numerará al emitir. Si no eliges ninguna se usa la predeterminada (F, A o R según el tipo).",
        },
        {
          title: "Añade las líneas",
          text: "Rellena **Concepto**, **Cant.**, **Precio**, **Dto. %** e **IVA** (21, 10, 4 o 0 %, además del tipo general que tengas en Tarifas). Usa **Añadir línea** para más y el icono de papelera para quitar una.",
        },
        {
          title: "Añade notas",
          text: "Escribe en **Notas en la factura** cualquier texto que deba aparecer impreso.",
        },
        {
          title: "Guarda",
          text: "Pulsa **Guardar borrador**. Mientras haya cambios sin guardar verás el aviso **Cambios sin guardar**.",
          tip: "Guarda antes de emitir: el botón Emitir usa la última versión guardada del borrador.",
        },
        {
          title: "Previsualiza o borra",
          text: "Pulsa **Vista previa** para ver el PDF del borrador, o **Borrar** si ya no lo necesitas. Al no tener número, borrarlo no deja huecos en la numeración.",
        },
      ],
    },
    {
      slug: "emitir-factura",
      title: "Emitir una factura",
      summary: "Asigna número y fecha a un borrador y deja la factura lista para enviar y cobrar.",
      path: "/app/ventas",
      roles: "Administrador",
      steps: [
        {
          title: "Abre el borrador",
          text: "En **Ventas** pulsa el borrador (en la columna Número aparece como **Borrador**).",
        },
        {
          title: "Comprueba los requisitos",
          text: "La factura necesita cliente, al menos una línea y descripción en todas las líneas. Si el total es de 400 € o más, el cliente debe tener NIF.",
        },
        {
          title: "Emite",
          text: "Pulsa **Emitir** y confirma en el diálogo **Emitir factura**. Se asigna el siguiente número de la serie del año (por ejemplo F2026-0001) y la fecha de hoy.",
          tip: "Una vez emitida no se puede modificar. Si hay un error, crea una rectificativa.",
        },
        {
          title: "Revisa el vencimiento",
          text: "Si no indicaste vencimiento, se calcula con los días de pago del cliente (30 días si no tiene).",
        },
        {
          title: "Consulta el registro Verifactu",
          text: "En la columna derecha, la tarjeta **Registro Verifactu** muestra el estado del envío, la **Huella** de la factura y la **Huella anterior** con la que se encadena.",
          tip: "Mientras la conexión con la Agencia Tributaria esté en modo simulado, el estado aparece como Simulado.",
        },
      ],
    },
    {
      slug: "registrar-cobro",
      title: "Registrar el cobro de una factura",
      summary: "Apunta cobros totales o parciales y, si quieres, crea el movimiento bancario conciliado.",
      path: "/app/ventas",
      roles: "Administrador",
      steps: [
        {
          title: "Abre la factura",
          text: "Abre una factura emitida con importe pendiente y pulsa **Registrar cobro**.",
        },
        {
          title: "Indica importe y fecha",
          text: "El diálogo muestra el **Pendiente**. Ajusta el **Importe** si es un cobro parcial y la **Fecha**.",
        },
        {
          title: "Elige la forma de pago",
          text: "Selecciona la **Forma de pago**: Transferencia, Tarjeta, Efectivo, Domiciliación, Bizum u Otro.",
        },
        {
          title: "Elige la cuenta",
          text: "En **Cuenta** elige la cuenta bancaria o **Sin cuenta (caja)**. Añade una **Referencia** si la tienes.",
        },
        {
          title: "Crea el movimiento conciliado",
          text: "Con una cuenta elegida, deja marcado **Crear el movimiento bancario conciliado** para que aparezca en Tesorería ya conciliado. Pulsa **Registrar**.",
          tip: "Si vas a importar el extracto del banco, desmarca la casilla y concilia el movimiento importado para no duplicarlo.",
        },
        {
          title: "Revisa el estado",
          text: "El cobro aparece en la tarjeta **Cobros**. Cuando lo cobrado cubre el total, la factura pasa a **Cobrada**.",
        },
      ],
      notes: [
        "Un cobro con importe negativo resta lo cobrado; úsalo para corregir un cobro apuntado por error.",
        "Si la factura ya está **Cobrada**, el botón Registrar cobro desaparece: pulsa **Más acciones** y elige **Corregir cobro**. El importe propuesto es lo cobrado en negativo; ajústalo y pulsa **Registrar**. La factura vuelve a tener importe pendiente.",
      ],
    },
    {
      slug: "enviar-y-descargar",
      title: "Enviar la factura y descargar PDF o XML",
      summary: "Manda la factura por correo con el PDF adjunto o descárgala en PDF o en XML de factura electrónica.",
      path: "/app/ventas",
      roles: "Administrador",
      steps: [
        {
          title: "Abre la factura emitida",
          text: "Solo las facturas emitidas se pueden enviar. En la cabecera tienes el botón **PDF** para verla en el navegador.",
        },
        {
          title: "Abre más acciones",
          text: "Pulsa el botón de tres puntos (**Más acciones**).",
        },
        {
          title: "Envía por correo",
          text: "Elige **Enviar por correo**. Revisa **Para** (se rellena con el correo del cliente) y escribe un **Mensaje** o déjalo vacío para usar el estándar. Pulsa **Enviar**.",
          tip: "El PDF se adjunta automáticamente y el envío queda registrado en la auditoría.",
        },
        {
          title: "Descarga el PDF",
          text: "Elige **Descargar PDF** para guardar el archivo.",
        },
        {
          title: "Descarga el XML",
          text: "Elige **Descargar XML (factura electrónica)** para obtener la factura en formato Facturae.",
        },
      ],
    },
    {
      slug: "rectificar-factura",
      title: "Rectificar una factura emitida",
      summary: "Corrige o anula una factura emitida con una rectificativa de la serie R.",
      path: "/app/ventas",
      roles: "Administrador",
      steps: [
        {
          title: "Abre la factura original",
          text: "Abre la factura emitida, pulsa **Más acciones** y elige **Rectificar**.",
          tip: "No aparece en rectificativas ni en facturas que ya tienen una rectificativa.",
        },
        {
          title: "Indica el motivo",
          text: "Escribe el **Motivo** (por ejemplo, error en el NIF o devolución parcial) y pulsa **Crear rectificativa**.",
        },
        {
          title: "Ajusta las líneas",
          text: "Se abre un borrador con todas las líneas de la original en negativo y una nota con la factura rectificada y el motivo. Ajusta las líneas si la corrección es parcial y pulsa **Guardar borrador**.",
        },
        {
          title: "Emite la rectificativa",
          text: "Pulsa **Emitir**. Recibe número de la serie R.",
          tip: "Si la rectificativa anula el importe total, la factura original pasa a **Anulada**.",
        },
        {
          title: "Sigue el vínculo",
          text: "En la columna derecha verás **Rectifica a** en la rectificativa y **Rectificada por** en la original, con enlaces entre ambas.",
        },
      ],
    },
    {
      slug: "series-de-facturacion",
      title: "Consultar las series de facturación",
      summary: "Comprueba qué series hay cada año y cuál será el siguiente número.",
      path: "/app/ventas?vista=series",
      roles: "Administrador",
      steps: [
        {
          title: "Abre la pestaña Series",
          text: "En **Ventas** pulsa la pestaña **Series**.",
        },
        {
          title: "Revisa la tabla",
          text: "Verás **Código**, **Nombre**, **Tipo**, **Año** y **Siguiente número** de cada serie.",
        },
        {
          title: "Entiende la numeración",
          text: "Cada empresa empieza con las series F (Facturas), A (Anticipos) y R (Rectificativas). La numeración es correlativa por año y empieza en 1.",
          tip: "Si no existe la serie del año en curso, se crea automáticamente al emitir la primera factura del año.",
        },
        {
          title: "Crea una serie",
          text: "Pulsa **Nueva serie**, rellena **Código** (mayúsculas y números, hasta 6), **Año**, **Nombre** y **Tipo**, y pulsa **Crear serie**.",
        },
        {
          title: "Usa la serie en una factura",
          text: "Abre un borrador del mismo tipo que la serie y elígela en **Serie**. Pulsa **Guardar borrador** y emite: el número sale de esa serie (por ejemplo B2026-0001).",
          tip: "Si emites en un año distinto al de la serie, se usa el mismo código en la serie del año de emisión, que se crea si no existe.",
        },
      ],
    },
    {
      slug: "buscar-y-exportar-ventas",
      title: "Buscar facturas y exportar el libro de emitidas",
      summary: "Filtra tus documentos de venta y descarga el libro registro en CSV.",
      path: "/app/ventas",
      roles: "Administrador",
      steps: [
        {
          title: "Elige la vista",
          text: "Usa las pestañas **Facturas**, **Anticipos** y **Rectificativas**.",
        },
        {
          title: "Filtra",
          text: "Busca por número, cliente o NIF y combina **Estado**, **Serie**, **Desde** y **Hasta**. Pulsa **Filtrar**, o **Limpiar** para quitar los filtros.",
        },
        {
          title: "Lee los totales",
          text: "Los indicadores muestran **Pendiente de cobro**, **Vencido**, **Borradores** y **Base en la vista**. Al pie de la tabla tienes la suma de base, total y pendiente.",
        },
        {
          title: "Exporta el libro",
          text: "Pulsa **Libro de emitidas** para descargar un CSV con fecha, número, tipo, NIF, cliente, desglose de IVA, total, si rectifica y la huella.",
          tip: "Usa las fechas Desde y Hasta del filtro para acotar el periodo; sin ellas se exporta el año en curso. El CSV usa punto y coma como separador.",
        },
      ],
    },
    {
      slug: "registrar-compra",
      title: "Registrar una compra o un gasto",
      summary: "Apunta facturas de proveedor, gastos y tickets e imputa su coste a un proyecto.",
      path: "/app/compras",
      roles: "Administrador",
      steps: [
        {
          title: "Abre el formulario",
          text: "En **Compras** pulsa **Nueva compra**.",
        },
        {
          title: "Elige tipo y proveedor",
          text: "En **Tipo** elige **Factura de proveedor**, **Gasto** o **Ticket**, y selecciona el **Proveedor** (o **Sin proveedor**).",
        },
        {
          title: "Describe la compra",
          text: "Rellena **Concepto**, **Nº factura**, **Fecha**, **Vencimiento** y **Categoría**.",
        },
        {
          title: "Imputa a un proyecto",
          text: "Elige el **Proyecto** para que el coste cuente en su margen, o deja **Sin imputar**.",
        },
        {
          title: "Vincula un subalquiler",
          text: "Si es la factura de un subalquiler, elígelo en **Subalquiler**. Se rellenan proyecto, proveedor y categoría, y la base fija el coste real del subalquiler.",
        },
        {
          title: "Indica importes y guarda",
          text: "Escribe la **Base imponible**, elige el **IVA** y comprueba el **Total**. Pulsa **Guardar**.",
        },
      ],
      notes: [
        "Usa el lápiz de cada fila para editar una compra. Solo se pueden borrar las compras pendientes, no las pagadas.",
        "En una compra pagada con un movimiento bancario conciliado no se puede cambiar el importe: primero pulsa **Deshacer conciliación** en ese movimiento en Tesorería (la compra vuelve a pendiente), corrige la compra y vuelve a pagarla o conciliarla.",
      ],
    },
    {
      slug: "pagar-compra",
      title: "Pagar una compra y exportar el libro de recibidas",
      summary: "Marca compras como pagadas y descarga el libro registro de facturas recibidas.",
      path: "/app/compras",
      roles: "Administrador",
      steps: [
        {
          title: "Localiza la compra",
          text: "Filtra por concepto, número o proveedor y por **Estado** (**Pendiente** o **Pagada**), **Categoría** o fechas.",
          tip: "Los indicadores muestran lo **Pendiente de pago**, lo **Vencido**, el **Coste de subalquiler** y la **Base en la vista**.",
        },
        {
          title: "Registra el pago",
          text: "Pulsa **Pagar** en la fila. En **Registrar pago** elige la **Fecha de pago** y la **Cuenta**.",
        },
        {
          title: "Confirma",
          text: "Pulsa **Registrar pago**. Con una cuenta elegida se crea el movimiento bancario ya conciliado; con **Sin cuenta (caja)** solo se marca como pagada.",
        },
        {
          title: "Exporta el libro de recibidas",
          text: "Pulsa **Libro de recibidas** para descargar un CSV con fecha, número, NIF y nombre del proveedor, concepto, categoría, base, cuota de IVA, total, estado y fecha de pago.",
          tip: "Se exporta el periodo de los filtros Desde y Hasta, o el año en curso si no los usas.",
        },
      ],
    },
    {
      slug: "cuentas-bancarias",
      title: "Crear cuentas y añadir movimientos",
      summary: "Da de alta tus cuentas bancarias o la caja y apunta movimientos reales o previstos.",
      path: "/app/tesoreria",
      roles: "Administrador",
      steps: [
        {
          title: "Crea una cuenta",
          text: "En **Tesorería** pulsa **Cuenta**. Rellena **Nombre**, **IBAN**, **Saldo inicial** y **A fecha**, y pulsa **Crear**.",
          tip: "Puedes crear también una cuenta de caja para el efectivo.",
        },
        {
          title: "Selecciona la cuenta",
          text: "Pulsa la tarjeta de la cuenta para ver sus movimientos. Cada tarjeta muestra su saldo y cuántos movimientos tiene sin conciliar.",
        },
        {
          title: "Añade un movimiento",
          text: "Pulsa **Movimiento**, indica **Fecha**, **Importe** (positivo para entradas, negativo para salidas), **Concepto** y **Categoría**, y pulsa **Guardar**.",
          tip: "Si la fecha es futura, el movimiento queda como **Previsto** y solo cuenta en la previsión de caja.",
        },
        {
          title: "Filtra los movimientos",
          text: "Alterna entre **Todos** y **Sin conciliar**. La tabla muestra el saldo acumulado y el estado **Conciliado**, **Pendiente** o **Previsto**.",
        },
      ],
    },
    {
      slug: "importar-extracto",
      title: "Importar el extracto del banco",
      summary: "Carga los movimientos de tu banco desde un CSV para conciliarlos.",
      path: "/app/tesoreria",
      roles: "Administrador",
      steps: [
        {
          title: "Selecciona la cuenta",
          text: "En **Tesorería** pulsa la tarjeta de la cuenta a la que pertenece el extracto.",
        },
        {
          title: "Abre la importación",
          text: "Pulsa **Importar extracto**.",
        },
        {
          title: "Prepara el archivo",
          text: "El CSV debe tener las columnas fecha, concepto e importe, separadas por punto y coma o tabulador. Las fechas pueden ser dd/mm/aaaa o aaaa-mm-dd y los importes con coma decimal (por ejemplo -85,50).",
        },
        {
          title: "Carga los datos",
          text: "Elige el archivo o pega el contenido en el cuadro de texto y pulsa **Importar**.",
        },
        {
          title: "Revisa el resultado",
          text: "Verás cuántos movimientos se han importado y cuántos duplicados se han ignorado. Si alguna línea tiene errores, se muestra un aviso con las primeras.",
          tip: "Puedes importar extractos que se solapan: los movimientos con la misma fecha, concepto e importe ya existentes no se duplican.",
        },
      ],
    },
    {
      slug: "conciliar-movimientos",
      title: "Conciliar movimientos bancarios",
      summary: "Vincula cada movimiento del banco con un cobro, una compra o una categoría.",
      path: "/app/tesoreria",
      roles: "Administrador",
      steps: [
        {
          title: "Muestra los pendientes",
          text: "En **Tesorería** elige la cuenta y pulsa **Sin conciliar**.",
        },
        {
          title: "Abre la conciliación",
          text: "Pulsa **Conciliar** en el movimiento.",
        },
        {
          title: "Asigna un cobro o una compra",
          text: "En la pestaña **Con un cobro de factura** (entradas) o **Con una compra** (salidas) verás los candidatos ordenados por coincidencia. Pulsa **Asignar** en el correcto.",
          tip: "Los candidatos con importe exacto aparecen primero y destacados. Al asignar una factura se registra el cobro por el importe del movimiento.",
        },
        {
          title: "O solo categoriza",
          text: "Para comisiones, impuestos o traspasos, ve a **Solo categorizar**, elige la **Categoría** y pulsa **Marcar como conciliado**.",
        },
        {
          title: "Deshaz si te equivocas",
          text: "En un movimiento conciliado con una compra o una categoría pulsa **Deshacer conciliación**. La compra vuelve a quedar pendiente.",
          tip: "Los movimientos vinculados a un cobro de factura no se desconcilian desde aquí: corrige el cobro con un cobro negativo desde la factura (en una factura cobrada, **Más acciones** > **Corregir cobro**).",
        },
      ],
      notes: ["Para borrar un movimiento conciliado, deshaz antes la conciliación. Los movimientos previstos se borran con su icono de papelera."],
    },
    {
      slug: "prevision-de-caja",
      title: "Consultar la previsión de caja",
      summary: "Anticipa los próximos 90 días de tesorería y detecta a tiempo los saldos negativos.",
      path: "/app/tesoreria",
      roles: "Administrador",
      steps: [
        {
          title: "Revisa los indicadores",
          text: "En **Tesorería** tienes **Saldo total**, **Cobros previstos** (facturas emitidas pendientes), **Pagos previstos** (compras pendientes) y **Saldo a 30 días**.",
        },
        {
          title: "Lee el gráfico",
          text: "**Previsión de caja · 90 días** suma al saldo actual los cobros por fecha de vencimiento, resta los pagos pendientes y aplica los movimientos previstos.",
          tip: "Las facturas ya vencidas se prevén cobradas en 7 días.",
        },
        {
          title: "Detecta el mínimo",
          text: "La etiqueta **Mínimo** indica el saldo más bajo del periodo y su fecha. Se marca en rojo si es negativo.",
        },
        {
          title: "Añade previsiones",
          text: "Para nóminas, impuestos u otros pagos conocidos, crea un **Movimiento** con fecha futura y aparecerá en la previsión.",
        },
      ],
    },
  ],
};
