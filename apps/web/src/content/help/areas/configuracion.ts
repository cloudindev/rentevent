import type { HelpArea } from "../types";

export const area: HelpArea = {
  slug: "configuracion",
  title: "Configuración",
  summary: "Datos de la empresa, usuarios y permisos, tarifas, impuestos, plantillas, importaciones, integraciones, API, seguridad y suscripción.",
  overview: [
    "Configuración reúne todo lo que define cómo funciona tu empresa en Rentevent. Se abre desde el pie de la barra lateral y se organiza en pestañas: Empresa, Usuarios y roles, Tarifas, Impuestos y series, Plantillas, Suscripción, Importar, API y webhooks, Seguridad y datos e Integraciones.",
    "Casi todas las pestañas son exclusivas del Administrador. La pestaña Importar está disponible también para quien puede gestionar inventario (Jefe de almacén) o pedidos, proyectos y contactos (Comercial), y cada uno solo puede importar lo que su rol permite.",
    "Lo que configuras aquí se usa en el resto de la aplicación: los datos fiscales, el logotipo y el color de marca aparecen en presupuestos, facturas y albaranes; las tarifas calculan los precios de los pedidos; las reglas de funcionamiento afectan a la disponibilidad y a las opciones; y los permisos por campo deciden quién ve márgenes y costes.",
    "Tus datos personales (nombre, contraseña, verificación en dos pasos) no están aquí, sino en Perfil y seguridad.",
  ],
  concepts: [
    { term: "Datos fiscales", definition: "Nombre comercial, razón social, NIF, IBAN y dirección que aparecen en los documentos." },
    { term: "Dirección de la base", definition: "Dirección de tu nave o almacén. Se geolocaliza para calcular kilómetros de transporte." },
    { term: "Margen entre retorno y carga", definition: "Minutos de revisión que necesita el material tras volver antes de poder salir de nuevo." },
    { term: "Caducidad de las opciones", definition: "Días que se mantiene reservado un pedido en opción." },
    { term: "Permisos por rol", definition: "Tabla fija de lo que puede hacer cada rol en la aplicación." },
    { term: "Permisos por campo", definition: "Ajuste por empresa de qué roles ven el margen, los costes y el coste por hora del personal." },
    { term: "Tramo de duración", definition: "Factor que multiplica la tarifa diaria de los artículos por día según los días de alquiler." },
    { term: "Clave de API", definition: "Credencial para que otros programas usen la API de Rentevent en nombre de tu empresa." },
    { term: "Webhook", definition: "Aviso automático que Rentevent envía a una URL cuando ocurre un evento, como un pedido confirmado." },
    { term: "Modo simulado", definition: "Funcionamiento de un servicio externo sin conexión real: el resultado se registra pero no se envía ni se cobra." },
    { term: "Registro de auditoría", definition: "Historial de cada cambio en la empresa con su autor, fecha y campos modificados." },
  ],
  articles: [
    {
      slug: "datos-de-empresa",
      title: "Completar los datos de la empresa",
      summary: "Rellena los datos fiscales que aparecen en presupuestos, facturas y albaranes.",
      path: "/app/configuracion",
      roles: "Administrador",
      steps: [
        {
          title: "Abre la pestaña Empresa",
          text: "Pulsa **Configuración** al pie de la barra lateral. Se abre la pestaña **Empresa**, con tu subdominio indicado en la tarjeta **Datos fiscales**.",
        },
        {
          title: "Rellena la identificación",
          text: "Completa **Nombre comercial**, **Razón social**, **NIF / CIF** e **IBAN**.",
          tip: "El nombre comercial es el que se ve en la barra lateral y en el selector de empresas.",
        },
        {
          title: "Indica la dirección de la base",
          text: "Escribe **Dirección de la base**, **Código postal**, **Población** y **Provincia**.",
          tip: "Al guardar se geolocaliza la dirección y debajo verás las coordenadas. Se usan para calcular los kilómetros del transporte.",
        },
        {
          title: "Añade el contacto",
          text: "Rellena **Teléfono**, **Correo** y **Web**.",
        },
        {
          title: "Guarda",
          text: "Pulsa **Guardar cambios**. Verás **Guardado**, o **Guardado · ubicación de la base actualizada** si la dirección se ha geolocalizado.",
        },
      ],
      notes: ["Si no eres administrador, al abrir Configuración verás un aviso que te remite a tu perfil."],
    },
    {
      slug: "logotipo-y-color",
      title: "Subir el logotipo y elegir el color de marca",
      summary: "Personaliza tus documentos y tu página de acceso con tu imagen.",
      path: "/app/configuracion",
      roles: "Administrador",
      steps: [
        {
          title: "Sube el logotipo",
          text: "En **Empresa**, tarjeta **Datos fiscales**, pulsa **Subir logotipo** y elige la imagen.",
          tip: "Formatos PNG, JPG, SVG o WebP, de 2 MB como máximo. Se guarda al momento, sin pulsar Guardar cambios.",
        },
        {
          title: "Comprueba el resultado",
          text: "Verás **Logotipo actualizado** y la vista previa. El logo aparece en la barra lateral, en el selector de empresas, en la página de acceso de tu subdominio y en los PDF.",
        },
        {
          title: "Elige el color de marca",
          text: "En la tarjeta **Funcionamiento**, usa el selector de **Color de marca** o escribe el código hexadecimal (por ejemplo #F95F40).",
        },
        {
          title: "Guarda",
          text: "Pulsa **Guardar cambios**.",
        },
      ],
    },
    {
      slug: "reglas-de-funcionamiento",
      title: "Ajustar las reglas de reserva y presupuesto",
      summary: "Define el margen entre servicios, la caducidad de las opciones y la validez de los presupuestos.",
      path: "/app/configuracion",
      roles: "Administrador",
      steps: [
        {
          title: "Abre la tarjeta Funcionamiento",
          text: "En la pestaña **Empresa**, baja hasta **Funcionamiento**.",
        },
        {
          title: "Margen entre retorno y carga",
          text: "Indica en **Margen entre retorno y carga (min)** el tiempo de revisión que necesita el material antes de volver a salir.",
        },
        {
          title: "Caducidad de las opciones",
          text: "Indica en **Caducidad de las opciones (días)** cuántos días se mantiene una reserva en opción (entre 1 y 90).",
        },
        {
          title: "Validez y condiciones del presupuesto",
          text: "Ajusta **Validez del presupuesto (días)** y escribe las **Condiciones del presupuesto**.",
          tip: "Las condiciones y la validez también se pueden editar en la pestaña Plantillas: es el mismo dato.",
        },
        {
          title: "Guarda",
          text: "Pulsa **Guardar cambios**.",
        },
      ],
    },
    {
      slug: "invitar-usuarios",
      title: "Invitar usuarios y gestionar invitaciones",
      summary: "Da acceso a tu equipo con el rol adecuado para cada persona.",
      path: "/app/configuracion/usuarios",
      roles: "Administrador",
      steps: [
        {
          title: "Abre Usuarios y roles",
          text: "En **Configuración** pulsa la pestaña **Usuarios y roles**.",
        },
        {
          title: "Invita a una persona",
          text: "En **Invitar a una persona** escribe el **Correo**, elige el **Rol** y pulsa **Invitar**.",
          tip: "La persona recibe un correo con un enlace válido 7 días. Si ya pertenece a la empresa, se te avisará.",
        },
        {
          title: "Revisa las pendientes",
          text: "Las invitaciones sin aceptar aparecen debajo como **Pendiente**, con su rol y la fecha de caducidad.",
        },
        {
          title: "Reenvía o anula",
          text: "Pulsa **Reenviar** si la persona no encuentra el correo, o **Anular** para retirar la invitación.",
        },
      ],
    },
    {
      slug: "cambiar-rol-o-quitar",
      title: "Cambiar el rol de un usuario o quitarlo",
      summary: "Ajusta los permisos de cada persona o retírale el acceso a la empresa.",
      path: "/app/configuracion/usuarios",
      roles: "Administrador",
      steps: [
        {
          title: "Localiza al usuario",
          text: "En **Usuarios y roles**, la tabla **Usuarios** muestra cada persona con su correo, su **Rol** y la fecha de alta (**Desde**).",
        },
        {
          title: "Cambia el rol",
          text: "Elige el nuevo rol en el desplegable de su fila. El cambio se aplica al momento.",
          tip: "No puedes cambiar tu propio rol, y siempre debe quedar al menos un administrador.",
        },
        {
          title: "Quita a un usuario",
          text: "Pulsa **Quitar** y confirma. La persona pierde el acceso a esta empresa, pero conserva su cuenta y sus otras empresas.",
          tip: "No puedes quitarte a ti mismo ni al último administrador.",
        },
        {
          title: "Consulta los permisos de cada rol",
          text: "La tarjeta **Permisos por rol** muestra en una tabla qué permisos tiene cada rol. Es informativa: los permisos de cada rol son fijos.",
        },
      ],
    },
    {
      slug: "permisos-por-campo",
      title: "Decidir quién ve márgenes y costes",
      summary: "Muestra u oculta datos sensibles a cada rol con los permisos por campo.",
      path: "/app/configuracion/usuarios",
      roles: "Administrador",
      steps: [
        {
          title: "Abre Permisos por campo",
          text: "En **Usuarios y roles**, baja hasta la tarjeta **Permisos por campo**.",
        },
        {
          title: "Revisa la matriz",
          text: "Para cada rol hay tres interruptores: **Margen**, **Costes** y **Coste/hora personal**.",
          tip: "Por defecto, margen y costes los ven Administrador y Comercial; el coste por hora del personal solo el Administrador.",
        },
        {
          title: "Ajusta los interruptores",
          text: "Activa o desactiva cada dato por rol. Los del Administrador no se pueden cambiar.",
        },
        {
          title: "Guarda",
          text: "Pulsa **Guardar** en la cabecera de la tarjeta. Verás **Permisos por campo guardados**.",
        },
      ],
      notes: ["Estos permisos se aplican en pedidos, proyectos, personal y en las columnas de coste y margen del Dashboard financiero."],
    },
    {
      slug: "tarifas",
      title: "Configurar las tarifas",
      summary: "Define el precio de las carpas, los factores por duración, los suplementos, el transporte y la mano de obra.",
      path: "/app/configuracion/tarifas",
      roles: "Administrador",
      steps: [
        {
          title: "Precio de las carpas",
          text: "En **Carpas por superficie** indica el precio de cada familia y su unidad: **€ / m²** o **€ / metro lineal**.",
          tip: "El precio base incluye estructura, lonas blancas, montaje estándar y los días incluidos. Las jaimas no aparecen en esta lista.",
        },
        {
          title: "Tramos de duración",
          text: "En **Duración** define tramos de días y su factor sobre la tarifa diaria de los artículos por día. Usa **Tramo** para añadir uno y la papelera para quitarlo.",
          tip: "Entre tramos el factor se interpola. Debajo verás un ejemplo calculado para 5 y 10 días.",
        },
        {
          title: "Días adicionales y carpas",
          text: "Ajusta **Factor por día adicional**, **Días incluidos en carpas** y **% por día extra de carpa**.",
        },
        {
          title: "Suplementos e IVA",
          text: "En **Suplementos, transporte y mano de obra** indica el **IVA general %** y el **Suplemento festivo %**.",
        },
        {
          title: "Transporte",
          text: "Rellena **Transporte €/km (ida y vuelta)**, **Transporte mínimo €** y **Coste transporte €/km**, que se usa para calcular el margen.",
        },
        {
          title: "Mano de obra",
          text: "Rellena **Mano de obra €/h** (precio) y **Coste mano de obra €/h** (para el margen).",
        },
        {
          title: "Guarda",
          text: "Pulsa **Guardar tarifas**.",
          tip: "No puede haber dos tramos con el mismo número de días.",
        },
      ],
    },
    {
      slug: "impuestos-y-series",
      title: "Revisar impuestos y series de facturación",
      summary: "Consulta los tipos de IVA en uso y las series de facturación del año.",
      path: "/app/configuracion/impuestos",
      roles: "Administrador",
      steps: [
        {
          title: "Abre la pestaña",
          text: "En **Configuración** pulsa **Impuestos y series**.",
        },
        {
          title: "Revisa los tipos de IVA",
          text: "**Tipos de IVA** muestra el tipo general, el reducido (10 %), el superreducido (4 %) y el exento (0 %), con cuántas líneas de pedido usan cada uno.",
          tip: "El tipo general se aplica por defecto a todas las líneas. Para cambiarlo, edita IVA general % en la pestaña Tarifas.",
        },
        {
          title: "Consulta las series del año",
          text: "**Series de facturación** lista cada serie del año en curso con su nombre, tipo y **Próximo número**.",
        },
        {
          title: "Gestiona las series",
          text: "Para ver series de otros años o crear una nueva, ve a **Ventas** y abre la pestaña **Series**.",
        },
      ],
      notes: ["La numeración es correlativa sin huecos y cada factura emitida se encadena con una huella, preparada para Verifactu y la factura electrónica."],
    },
    {
      slug: "plantillas",
      title: "Editar condiciones y plantillas",
      summary: "Ajusta las condiciones de tus presupuestos y consulta las plantillas de correo.",
      path: "/app/configuracion/plantillas",
      roles: "Administrador",
      steps: [
        {
          title: "Edita las condiciones del presupuesto",
          text: "En **Condiciones del presupuesto** escribe las **Condiciones** y la **Validez (días)** y pulsa **Guardar**.",
          tip: "Se imprimen al final de cada presupuesto y en la página de aceptación que ve el cliente.",
        },
        {
          title: "Consulta las plantillas de correo",
          text: "**Plantillas de correo** lista cada plantilla con su nombre, su clave y su asunto.",
        },
        {
          title: "Usa variables",
          text: "En las plantillas puedes usar {{cliente}}, {{evento}}, {{pedido}}, {{enlace}}, {{montaje}}, {{retorno}}, {{empresa}} y {{trabajador}}.",
        },
        {
          title: "Edita una plantilla",
          text: "Pulsa **Editar en Emails** para abrir la pestaña Plantillas de la sección Emails, donde se crean y modifican.",
        },
        {
          title: "Revisa los documentos PDF",
          text: "Presupuestos, facturas, albaranes y certificados usan tu logotipo, tu color de marca y los datos fiscales de la pestaña **Empresa**.",
        },
      ],
    },
    {
      slug: "importar-datos",
      title: "Importar datos desde CSV o Excel",
      summary: "Carga tu inventario, tus contactos o tus proyectos desde otra herramienta o una hoja de cálculo.",
      path: "/app/configuracion/importar",
      roles: "Administrador, Comercial, Jefe de almacén",
      intro: "Acepta exportaciones de Rentman y hojas de cálculo propias. Nada se guarda hasta que pulses Importar.",
      steps: [
        {
          title: "Elige qué importar",
          text: "Pulsa **Inventario** (se actualiza por SKU), **Clientes y proveedores** (por NIF o, si no hay, por nombre) o **Proyectos** (se crean como consulta con un pedido en borrador).",
          tip: "Elige el tipo antes del archivo: al cambiar de tipo se descarta la vista previa y tendrás que volver a elegir el archivo.",
        },
        {
          title: "Sube el archivo",
          text: "Pulsa **Elige un archivo .csv o .xlsx**. Máximo 10 MB y 5.000 filas; en CSV, separador coma o punto y coma.",
        },
        {
          title: "Revisa las columnas",
          text: "En **Columnas** cada campo de Rentevent se asocia a una columna del archivo. Corrige las que no cuadren o elige **No importar**. Los campos con asterisco son obligatorios.",
        },
        {
          title: "Revalida la vista previa",
          text: "Pulsa **Revalidar** tras cambiar columnas. La tabla muestra las primeras filas con su **Estado** (**OK** o el error).",
          tip: "Despliega **Ver filas con errores** para ver todos los problemas. Esas filas se omitirán.",
        },
        {
          title: "Simula",
          text: "Pulsa **Simular** para ver cuántos registros serían nuevos, actualizados y omitidos sin guardar nada.",
        },
        {
          title: "Importa",
          text: "Pulsa **Importar** con el número de filas válidas. Verás el resumen de nuevos, actualizados y omitidos.",
          tip: "La importación es de todo o nada: si falla, no se guarda ninguna fila.",
        },
      ],
      notes: ["El Comercial puede importar clientes, proveedores y proyectos; el Jefe de almacén, inventario; el Administrador, todo."],
    },
    {
      slug: "integraciones",
      title: "Consultar el estado de las integraciones",
      summary: "Comprueba qué servicios externos están conectados y cuáles funcionan en modo simulado.",
      path: "/app/configuracion/integraciones",
      roles: "Administrador",
      steps: [
        {
          title: "Abre la pestaña",
          text: "En **Configuración** pulsa **Integraciones**.",
        },
        {
          title: "Revisa cada servicio",
          text: "La tabla lista **Correo**, **Almacenamiento**, **Pagos**, **Mapas**, **WhatsApp**, **Asistente IA**, **Notificaciones push** y **Cola de trabajos**, con su **Modo**: **Conectado** o **Simulado**.",
        },
        {
          title: "Entiende el modo simulado",
          text: "La columna **En modo simulado** explica qué ocurre sin conexión real. Por ejemplo, los correos se guardan en el buzón de pruebas y el cambio de plan se activa sin cobro.",
        },
        {
          title: "Activa un servicio",
          text: "La columna **Variables** indica qué variables de entorno del despliegue hay que configurar. Por ejemplo, SMTP_URL y EMAIL_FROM para el correo, o ANTHROPIC_API_KEY y AI_MODEL para el asistente IA.",
          tip: "Estas variables se configuran en el servidor donde está desplegado Rentevent, no desde esta pantalla.",
        },
      ],
    },
    {
      slug: "claves-de-api",
      title: "Crear y revocar claves de API",
      summary: "Conecta tu ERP, tu web u otras herramientas con la API de Rentevent.",
      path: "/app/configuracion/api",
      roles: "Administrador",
      steps: [
        {
          title: "Abre API y webhooks",
          text: "En **Configuración** pulsa **API y webhooks**. En **Claves de API** verás la URL base de la API y un enlace a la especificación openapi.json.",
        },
        {
          title: "Crea una clave",
          text: "Escribe el **Nombre de la clave** (por ejemplo, el nombre de la herramienta que la usará) y pulsa **Crear clave**.",
        },
        {
          title: "Copia el secreto",
          text: "En **Clave creada** pulsa el botón de copiar y guarda la clave. Se usa como Authorization: Bearer en las llamadas.",
          tip: "Cópiala en ese momento: no volverá a mostrarse.",
        },
        {
          title: "Controla su uso",
          text: "La lista muestra quién creó cada clave, cuándo y su último uso, con el estado **Activa** o **Revocada**.",
        },
        {
          title: "Revoca una clave",
          text: "Pulsa **Revocar** y confirma. Las integraciones que la usen dejarán de funcionar.",
        },
      ],
    },
    {
      slug: "webhooks",
      title: "Configurar webhooks",
      summary: "Recibe avisos automáticos en tus sistemas cuando se crean pedidos, se aceptan presupuestos o se emiten facturas.",
      path: "/app/configuracion/api",
      roles: "Administrador",
      steps: [
        {
          title: "Crea un webhook",
          text: "En **API y webhooks**, tarjeta **Webhooks**, pulsa **Webhook**.",
        },
        {
          title: "Indica la URL",
          text: "Escribe la **URL** que recibirá los avisos. Debe empezar por https://.",
        },
        {
          title: "Elige los eventos",
          text: "Marca los eventos que quieres recibir: order.created, order.updated, order.confirmed, order.cancelled, quote.sent, quote.accepted, invoice.issued o contact.created. Marca la opción * (todos) para recibirlos todos.",
        },
        {
          title: "Actívalo y guarda",
          text: "Deja activado **Activo** y pulsa **Guardar**.",
        },
        {
          title: "Guarda el secreto de firma",
          text: "Copia el **Secreto de firma** que aparece al crearlo. Sirve para verificar la cabecera X-Rentevent-Signature de cada envío.",
          tip: "Solo se muestra una vez.",
        },
        {
          title: "Prueba la entrega",
          text: "Pulsa **Probar** para enviar un aviso de prueba. Verás **Entrega correcta** o **La URL no respondió con 2xx**.",
        },
        {
          title: "Revisa y reintenta",
          text: "En **Últimas entregas** verás cada envío con su evento, intentos y respuesta. Pulsa **Reintentar** en los fallidos.",
          tip: "Usa **Editar** para cambiar la URL, los eventos o pausarlo (desactivando Activo), y la papelera para eliminarlo.",
        },
      ],
    },
    {
      slug: "auditoria",
      title: "Consultar el registro de auditoría",
      summary: "Averigua quién cambió qué y cuándo en tu empresa.",
      path: "/app/configuracion/seguridad",
      roles: "Administrador",
      steps: [
        {
          title: "Abre Seguridad y datos",
          text: "En **Configuración** pulsa **Seguridad y datos**. Arriba está el **Registro de auditoría**.",
        },
        {
          title: "Filtra",
          text: "Elige la entidad (**Todas las entidades**), la acción (**Todas las acciones**) y el periodo (de **Últimos 1 días** a **Últimos 365 días**). Para buscar por persona, escribe en **Usuario…** y pulsa Intro.",
        },
        {
          title: "Lee los registros",
          text: "Cada fila muestra **Fecha**, **Usuario**, **Acción**, **Entidad** y **Cambios**. Pasa el ratón sobre Cambios para ver el detalle completo.",
          tip: "Se muestran como máximo los 200 registros más recientes que cumplan los filtros.",
        },
      ],
    },
    {
      slug: "exportar-datos-rgpd",
      title: "Exportar datos y atender derechos RGPD",
      summary: "Descarga todos los datos de la empresa y gestiona las solicitudes de acceso y supresión de un contacto.",
      path: "/app/configuracion/seguridad",
      roles: "Administrador",
      steps: [
        {
          title: "Exporta todos los datos",
          text: "En **Protección de datos (RGPD)** pulsa **Descargar exportación**. Obtendrás un archivo JSON con todas las tablas de la empresa y la lista de miembros.",
          tip: "Es tu copia propia de los datos. La exportación queda registrada en la auditoría.",
        },
        {
          title: "Elige un contacto",
          text: "En **Derechos de un contacto** selecciona el **Contacto**.",
        },
        {
          title: "Atiende un derecho de acceso",
          text: "Pulsa **Descargar sus datos** para obtener un JSON con su ficha, direcciones, personas, pedidos, facturas, correos y notas.",
        },
        {
          title: "Atiende un derecho de supresión",
          text: "Pulsa **Suprimir** y confirma. Si el contacto tiene facturas, se anonimiza y se conservan las facturas por obligación legal; si no, se elimina.",
          tip: "No se puede deshacer.",
        },
      ],
      notes: ["La base de datos tiene copias de seguridad diarias automáticas con recuperación a un instante (PITR), alojadas en la Unión Europea."],
    },
    {
      slug: "eliminar-empresa",
      title: "Eliminar la empresa",
      summary: "Borra de forma permanente la empresa y todos sus datos.",
      path: "/app/configuracion/seguridad",
      roles: "Administrador",
      steps: [
        {
          title: "Descarga antes una exportación",
          text: "En **Seguridad y datos** pulsa **Descargar exportación** y guarda el archivo. Después no habrá forma de recuperar los datos.",
        },
        {
          title: "Abre la zona de peligro",
          text: "Baja hasta la tarjeta **Eliminar la empresa**.",
        },
        {
          title: "Confirma con el subdominio",
          text: "Escribe exactamente el subdominio de tu empresa en el campo que lo pide.",
        },
        {
          title: "Elimina",
          text: "Pulsa **Eliminar definitivamente**. Volverás a **Espacios de trabajo** para elegir otra empresa o crear una nueva.",
        },
      ],
    },
    {
      slug: "suscripcion",
      title: "Elegir plan y gestionar la suscripción",
      summary: "Consulta tu prueba gratuita, elige plan y número de usuarios y accede a tus facturas de Rentevent.",
      path: "/app/configuracion/suscripcion",
      roles: "Administrador",
      steps: [
        {
          title: "Revisa tu plan actual",
          text: "En **Suscripción** verás el **Plan actual**, cuántos usuarios usas de tus plazas, los días de prueba que quedan y el estado: **En prueba**, **Activa**, **Pago pendiente**, **Cancelada** o **Incompleta**.",
        },
        {
          title: "Elige la periodicidad",
          text: "Activa **Pago anual** para obtener un 20 % de descuento.",
        },
        {
          title: "Indica el número de usuarios",
          text: "Ajusta **Usuarios**. Cada plan muestra su precio por usuario y el coste mensual total, IVA no incluido.",
        },
        {
          title: "Compara los planes",
          text: "**Básico** cubre carpas, disponibilidad y presupuestos; **Profesional** añade visor 3D, firma en línea, planificación de montadores, almacén con QR y facturación; **Empresa** añade asistente IA, workflows, API y soporte prioritario.",
        },
        {
          title: "Contrata",
          text: "Pulsa **Elegir plan** y completa el pago. Para el plan Empresa pulsa **Hablar con ventas**.",
          tip: "Al volver verás un aviso de confirmación. Si cancelas el pago, tu plan no cambia.",
        },
        {
          title: "Gestiona el pago",
          text: "Con una suscripción de pago activa, pulsa **Facturas y método de pago** para descargar tus facturas o cambiar la tarjeta.",
        },
      ],
      notes: [
        "Cuando quedan 7 días o menos de prueba, verás un aviso en la parte superior con el enlace Elegir plan. Si la suscripción deja de estar activa, el aviso cambia a Reactivar.",
      ],
    },
  ],
};
