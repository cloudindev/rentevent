import type { HelpArea } from "../types";

export const area: HelpArea = {
  slug: "primeros-pasos",
  title: "Primeros pasos",
  summary: "Crea tu cuenta, configura tu empresa con el asistente, entra en la aplicación y aprende a moverte por el back office.",
  overview: [
    "Rentevent funciona por espacios de trabajo: cada empresa tiene su propio subdominio, sus datos y sus usuarios. Una misma persona puede pertenecer a varias empresas y cambiar de una a otra sin cerrar sesión.",
    "Al registrarte creas a la vez tu usuario y tu empresa, con 14 días de prueba gratuita y sin tarjeta. Después de confirmar el correo entras directamente en el asistente de configuración, que te guía por los datos fiscales, las familias de carpa, la importación de datos y la invitación de tu equipo.",
    "El back office se organiza en una barra lateral con grupos (operación diaria, IA de Rentevent, Recursos, Finanzas y Otros). Cada persona solo ve las secciones que su rol permite. Desde cualquier pantalla puedes abrir las acciones rápidas con ⌘K (o Ctrl+K) para buscar y crear registros.",
    "Tu perfil personal (nombre, contraseña, verificación en dos pasos y sesiones abiertas) está en Perfil y seguridad. La configuración de la empresa, los usuarios y la suscripción están en Configuración y la gestiona el administrador.",
  ],
  concepts: [
    { term: "Espacio de trabajo", definition: "Una empresa dentro de Rentevent, con sus datos, usuarios y suscripción propios." },
    { term: "Subdominio", definition: "Dirección propia de tu empresa (tuempresa.dominio) que abre su página de acceso personalizada con tu logotipo." },
    { term: "Asistente de configuración", definition: "Guía de 6 pasos en Configura tu empresa para dejar la empresa lista para trabajar." },
    { term: "Acciones rápidas", definition: "Paleta de comandos (⌘K o Ctrl+K) para buscar pedidos, proyectos, contactos y artículos, crear registros e ir a cualquier sección." },
    { term: "Rol", definition: "Perfil de permisos de cada usuario: Administrador, Comercial, Jefe de almacén, Jefe de equipo, Montador o Solo lectura." },
    { term: "Verificación en dos pasos", definition: "Código de 6 dígitos de una app de autenticación que se pide al iniciar sesión, además de la contraseña." },
    { term: "Códigos de respaldo", definition: "Códigos de un solo uso para entrar si pierdes el móvil con la app de autenticación." },
  ],
  articles: [
    {
      slug: "crear-cuenta",
      title: "Crear tu cuenta y tu empresa",
      summary: "Regístrate, elige el subdominio de tu empresa y empieza la prueba gratuita de 14 días.",
      path: "/registro",
      steps: [
        {
          title: "Abre el registro",
          text: "Entra en la página **Crea tu cuenta**. Si ya usas Rentevent, pulsa **Inicia sesión** en lugar de registrarte.",
        },
        {
          title: "Indica la empresa y el subdominio",
          text: "Escribe el nombre en **Empresa**. El campo **Subdominio** se rellena solo a partir del nombre; puedes cambiarlo y verás debajo la dirección completa con un icono que indica si está disponible.",
          tip: "El subdominio necesita al menos 3 caracteres. Se quitan tildes y espacios, y algunos nombres están reservados (www, app, api, admin, ayuda, soporte, blog…).",
        },
        {
          title: "Completa tus datos",
          text: "Rellena **Tu nombre**, **Correo de trabajo** y **Contraseña**. La contraseña debe tener como mínimo 10 caracteres.",
        },
        {
          title: "Acepta las condiciones",
          text: "Marca la casilla de aceptación de los términos y la política de privacidad. Sin ella no se puede crear la cuenta.",
        },
        {
          title: "Empieza la prueba",
          text: "Pulsa **Empezar prueba gratuita**. Verás la pantalla **Revisa tu correo** con la dirección a la que hemos enviado el enlace de confirmación.",
        },
        {
          title: "Confirma el correo",
          text: "Abre el correo **Confirma tu correo en Rentevent** y pulsa **Confirmar correo**. Entrarás directamente al asistente de configuración.",
          tip: "No podrás iniciar sesión hasta que confirmes el correo. Si no lo ves, revisa la carpeta de spam.",
        },
      ],
      notes: ["Si ya existe una cuenta con ese correo, el formulario te lo indicará: en ese caso inicia sesión y crea una empresa nueva desde Espacios de trabajo."],
    },
    {
      slug: "crear-otra-empresa",
      title: "Crear otra empresa con tu misma cuenta",
      summary: "Añade un nuevo espacio de trabajo sin registrar otro usuario.",
      path: "/registro/empresa",
      steps: [
        {
          title: "Abre la creación de empresa",
          text: "En la barra lateral pulsa el nombre de tu empresa (arriba) y elige **Crear otra empresa**. También puedes ir a **Espacios de trabajo** y pulsar **Crear una empresa nueva**.",
        },
        {
          title: "Escribe el nombre",
          text: "En la pantalla **Crea tu empresa** rellena **Empresa**.",
        },
        {
          title: "Elige el subdominio (opcional)",
          text: "Escribe un **Subdominio** o déjalo vacío para que se genere a partir del nombre.",
        },
        {
          title: "Crea la empresa",
          text: "Pulsa **Crear empresa**. Serás su administrador, empezará con 14 días de prueba y se abrirá el asistente de configuración.",
        },
      ],
    },
    {
      slug: "asistente-configuracion",
      title: "Configurar tu empresa con el asistente",
      summary: "Recorre los 6 pasos de Configura tu empresa para dejarlo todo listo.",
      path: "/app/onboarding",
      roles: "Administrador",
      intro: "Puedes saltar cualquier paso y volver más tarde: el asistente recuerda en qué paso te quedaste. Mientras no lo termines, en Inicio verás un aviso con el botón Continuar.",
      steps: [
        {
          title: "Datos fiscales",
          text: "Sube tu logotipo con **Subir logotipo** y completa **Nombre comercial**, **Razón social**, **NIF / CIF**, **IBAN**, **Dirección de la base** y el resto de datos. Pulsa **Guardar cambios** para guardar y pasar al siguiente paso.",
          tip: "La dirección de la base se geolocaliza al guardar y se usa para calcular los kilómetros del transporte.",
        },
        {
          title: "Familias de carpa",
          text: "Marca los **Anchos que trabajas** (7, 10, 14, 15 y 20 m) y, si quieres, **Jaimas 5x5**. Pulsa **Cargar catálogo de ejemplo** para crear familias, artículos y reglas de despiece, o **Crear desde cero** para ir a Carpas.",
          tip: "Activa **Rellenar con stock de ejemplo** solo para hacer pruebas; si no, el stock empieza a 0. Si ya tienes familias de carpa, el paso solo muestra un aviso con enlace a Carpas.",
        },
        {
          title: "Datos del fabricante",
          text: "Revisa cuántas familias tienen datos por validar y pulsa **Abrir el asistente de fabricante** para ajustar correas, pesos, estacas y tensores a tu estructura real.",
        },
        {
          title: "Importar datos",
          text: "Elige qué importar (inventario, clientes y proveedores o proyectos) y sube un archivo .csv o .xlsx. Revisa la vista previa antes de pulsar **Importar**.",
        },
        {
          title: "Equipo",
          text: "En **Invita a tu equipo** escribe el **Correo** y elige el **Rol** de cada persona. Usa **Añadir otra** para más filas y pulsa **Enviar invitaciones**.",
          tip: "Las filas enviadas muestran **Enviada** y quedan bloqueadas para no duplicar la invitación.",
        },
        {
          title: "Listo",
          text: "En **Tu empresa está lista** pulsa **Crear un pedido** para probar tu primer pedido con carpa, o **Ir al inicio**. Cualquiera de los dos marca el asistente como terminado.",
        },
      ],
      notes: [
        "Usa **Atrás**, **Saltar** y **Continuar** para moverte, o pulsa directamente el número de cualquier paso en la parte superior.",
        "Puedes volver al asistente en cualquier momento desde la dirección /app/onboarding.",
      ],
    },
    {
      slug: "iniciar-sesion",
      title: "Iniciar sesión",
      summary: "Entra en Rentevent desde la página general o desde la página de acceso de tu empresa.",
      path: "/acceso",
      steps: [
        {
          title: "Abre la página de acceso",
          text: "Ve a la página **Bienvenido de nuevo**. Si entras por el subdominio de tu empresa verás **Entrar en** seguido del nombre y el logotipo de tu empresa; el formulario es el mismo.",
        },
        {
          title: "Escribe tus credenciales",
          text: "Rellena **Correo electrónico** y **Contraseña**.",
        },
        {
          title: "Decide si recordar la sesión",
          text: "Deja marcada **Recordar sesión** en tu ordenador habitual. Desmárcala en equipos compartidos.",
        },
        {
          title: "Entra",
          text: "Pulsa **Iniciar sesión**. Si tienes activada la verificación en dos pasos, se te pedirá el código en la pantalla **Verificación en dos pasos**.",
        },
        {
          title: "Introduce el código de verificación",
          text: "Escribe el código de 6 dígitos de tu app de autenticación y pulsa **Verificar**. Si no tienes el móvil, pulsa **Usar un código de respaldo**.",
          tip: "Marca **Confiar en este dispositivo 30 días** para no tener que introducir el código cada vez en ese equipo.",
        },
      ],
      notes: [
        "Equivocarte con la contraseña no bloquea la cuenta: puedes volver a intentarlo enseguida o pulsar **¿Has olvidado la contraseña?**.",
        "Si el correo aún no está confirmado, verás el aviso para confirmarlo antes de entrar.",
        "Los usuarios con rol Montador entran directamente en la app móvil de campo en lugar del back office.",
      ],
    },
    {
      slug: "recuperar-contrasena",
      title: "Recuperar la contraseña",
      summary: "Elige una contraseña nueva si has olvidado la tuya.",
      path: "/recuperar",
      steps: [
        {
          title: "Pide el enlace",
          text: "En la página de acceso pulsa **¿Has olvidado la contraseña?**, escribe tu **Correo electrónico** y pulsa **Enviar enlace**.",
        },
        {
          title: "Abre el correo",
          text: "Recibirás el correo **Restablece tu contraseña de Rentevent**. Pulsa **Elegir nueva contraseña**.",
          tip: "El enlace caduca en una hora. Por seguridad, el mensaje de confirmación es el mismo exista o no una cuenta con ese correo.",
        },
        {
          title: "Elige la nueva contraseña",
          text: "En **Elige una nueva contraseña** rellena **Nueva contraseña** y **Repite la contraseña** (mínimo 10 caracteres) y pulsa **Guardar contraseña**.",
        },
        {
          title: "Vuelve a entrar",
          text: "Verás **Contraseña cambiada**. Pulsa **Inicia sesión** y entra con la nueva contraseña.",
          tip: "Al restablecer la contraseña se cierran las sesiones abiertas en otros dispositivos.",
        },
      ],
    },
    {
      slug: "aceptar-invitacion",
      title: "Aceptar una invitación a una empresa",
      summary: "Únete a la empresa que te ha invitado, tengas o no cuenta en Rentevent.",
      steps: [
        {
          title: "Abre el enlace de la invitación",
          text: "Pulsa el enlace del correo de invitación. Verás el nombre de la empresa, el **Rol** que te han asignado y el correo invitado.",
          tip: "Las invitaciones son válidas 7 días. Si ves **Invitación no válida**, pide al administrador que te envíe otra.",
        },
        {
          title: "Si ya tienes sesión iniciada",
          text: "Pulsa **Aceptar invitación**. Entrarás en la empresa y se abrirá Inicio.",
        },
        {
          title: "Si no tienes cuenta",
          text: "Rellena **Tu nombre** y **Contraseña** (mínimo 10 caracteres) y pulsa **Crear cuenta y unirme**. Confirma el correo y volverás a la invitación para aceptarla.",
        },
        {
          title: "Si ya tienes cuenta pero no has entrado",
          text: "Pulsa **Inicia sesión** debajo del formulario. Tras entrar volverás a la invitación para aceptarla.",
        },
      ],
      notes: ["Las invitaciones pendientes también aparecen en **Espacios de trabajo** con el texto Invitación a y el nombre de la empresa."],
    },
    {
      slug: "navegar-back-office",
      title: "Moverte por el back office",
      summary: "Conoce la barra lateral, sus grupos y cómo plegarla o cambiar el tema.",
      path: "/app/inicio",
      steps: [
        {
          title: "Recorre los grupos de la barra lateral",
          text: "Arriba tienes la operación diaria: **Inicio**, **Agenda**, **Pedidos**, **Proyectos**, **Contactos** y **Subalquileres**. Debajo están los grupos **IA de Rentevent**, **Recursos**, **Finanzas** y **Otros**.",
          tip: "Solo ves las secciones que permite tu rol. Por ejemplo, el grupo Finanzas solo aparece a quien tiene permiso de finanzas.",
        },
        {
          title: "Abre la configuración",
          text: "Al pie de la barra lateral está **Configuración**. Los administradores gestionan ahí la empresa; el resto de roles ven las pestañas que les correspondan.",
        },
        {
          title: "Usa el menú de usuario",
          text: "Pulsa tu nombre al pie de la barra lateral para abrir **Perfil y seguridad**, **Espacios de trabajo**, elegir el **Tema** (**Claro**, **Oscuro** o **Sistema**) o **Cerrar sesión**.",
        },
        {
          title: "Pliega la barra lateral",
          text: "Pulsa el botón junto a tu nombre (**Plegar barra lateral**) para dejar solo los iconos. Al pasar el ratón por un icono verás su nombre. Vuelve a pulsarlo para expandirla.",
          tip: "El navegador recuerda si la dejaste plegada.",
        },
        {
          title: "En el móvil",
          text: "En pantallas pequeñas la barra lateral se abre con el botón de menú de la cabecera, y el icono de la lupa abre las acciones rápidas.",
        },
      ],
      notes: ["Si intentas abrir una sección sin permiso, volverás a Inicio con el aviso No tienes permiso para abrir esa sección."],
    },
    {
      slug: "cambiar-de-empresa",
      title: "Cambiar de espacio de trabajo",
      summary: "Pasa de una empresa a otra si perteneces a varias.",
      steps: [
        {
          title: "Abre el selector de empresa",
          text: "Pulsa el logotipo y el nombre de tu empresa en la parte superior de la barra lateral. Se abre la lista **Espacios de trabajo**.",
        },
        {
          title: "Elige la empresa",
          text: "Pulsa la empresa a la que quieras ir. La actual está marcada con un check. Se abrirá su Inicio.",
        },
        {
          title: "Alternativa: la página de espacios",
          text: "Desde el menú de usuario pulsa **Espacios de trabajo**. Verás **Elige un espacio de trabajo** con tus empresas y tu rol en cada una, las invitaciones pendientes y **Crear una empresa nueva**.",
        },
      ],
      notes: ["No confundas Espacios de trabajo (tus empresas) con la sección Espacios del grupo Recursos, que gestiona recintos y localizaciones de eventos."],
    },
    {
      slug: "acciones-rapidas",
      title: "Buscar y crear con las acciones rápidas",
      summary: "Usa ⌘K para encontrar cualquier registro o crear uno nuevo sin navegar por menús.",
      steps: [
        {
          title: "Abre la paleta",
          text: "Pulsa ⌘K en Mac o Ctrl+K en Windows, o el botón **Acciones rápidas** de la barra lateral. Vuelve a pulsar el atajo para cerrarla.",
        },
        {
          title: "Busca en tus datos",
          text: "Escribe al menos 2 caracteres. En **Resultados** aparecen pedidos, proyectos, contactos y artículos que coinciden.",
        },
        {
          title: "Crea un registro",
          text: "En el grupo **Crear** tienes **Nuevo pedido**, **Nuevo proyecto**, **Nuevo contacto**, **Nuevo artículo** y **Nueva familia de carpa**, según los permisos de tu rol.",
        },
        {
          title: "Ve a una sección",
          text: "En **Ir a** tienes todas las secciones a las que puedes acceder. También encuentra sinónimos: por ejemplo, escribir facturas te lleva a Ventas.",
        },
        {
          title: "Selecciona con el teclado",
          text: "Muévete con las flechas y pulsa Intro para abrir la opción resaltada.",
        },
      ],
    },
    {
      slug: "perfil-y-seguridad",
      title: "Tu perfil: nombre y contraseña",
      summary: "Cambia tu nombre, tu contraseña y revisa las sesiones abiertas.",
      path: "/app/perfil",
      steps: [
        {
          title: "Abre tu perfil",
          text: "Pulsa tu nombre al pie de la barra lateral y elige **Perfil y seguridad**. Bajo el título verás tu rol en la empresa actual.",
        },
        {
          title: "Cambia tu nombre",
          text: "En **Tus datos** edita **Nombre** y pulsa **Guardar**.",
        },
        {
          title: "Cambia la contraseña",
          text: "En **Contraseña** rellena **Actual**, **Nueva** y **Repite la nueva** (mínimo 10 caracteres) y pulsa **Cambiar contraseña**.",
          tip: "Deja activado **Cerrar sesión en los demás dispositivos** si crees que alguien más conoce tu contraseña.",
        },
        {
          title: "Revisa las sesiones activas",
          text: "En **Sesiones activas** verás cada navegador y dispositivo con tu cuenta abierta, su IP y la última actividad. La tuya aparece como (esta sesión).",
        },
        {
          title: "Cierra sesiones que no reconozcas",
          text: "Pulsa **Cerrar** en una sesión concreta o **Cerrar las demás** para dejar abierta solo la actual.",
        },
      ],
      notes: [
        "El enlace para suscribirte al calendario de tus turnos no está en este perfil: si tienes ficha de trabajador, lo encontrarás en el perfil de la app móvil de campo, en la sección Calendario.",
      ],
    },
    {
      slug: "verificacion-dos-pasos",
      title: "Activar la verificación en dos pasos",
      summary: "Protege tu cuenta pidiendo un código de tu móvil al iniciar sesión.",
      path: "/app/perfil",
      steps: [
        {
          title: "Instala una app de autenticación",
          text: "Usa cualquier app compatible, como Google Authenticator, 1Password o Authy.",
        },
        {
          title: "Inicia la activación",
          text: "En **Perfil y seguridad**, tarjeta **Verificación en dos pasos**, escribe **Tu contraseña** y pulsa **Activar**.",
        },
        {
          title: "Escanea el código QR",
          text: "Escanea el QR con tu app. Si no puedes escanearlo, usa el enlace de texto que aparece debajo.",
        },
        {
          title: "Guarda los códigos de respaldo",
          text: "Copia los **Códigos de respaldo** y guárdalos en un lugar seguro. Cada uno sirve una sola vez si pierdes el móvil.",
          tip: "Solo se muestran ahora. Sin ellos y sin el móvil no podrás completar el inicio de sesión.",
        },
        {
          title: "Confirma con un código",
          text: "Escribe en **Código** los 6 dígitos que muestra la app y pulsa **Verificar y activar**. El estado cambiará a **Activada**.",
        },
        {
          title: "Desactivarla si lo necesitas",
          text: "Para quitarla, escribe **Tu contraseña** y pulsa **Desactivar**.",
        },
      ],
    },
    {
      slug: "roles-y-permisos",
      title: "Qué puede hacer cada rol",
      summary: "Resumen de los seis roles de Rentevent y sus permisos.",
      path: "/app/configuracion/usuarios",
      intro: "El rol se elige al invitar a cada persona y lo puede cambiar el administrador en Configuración > Usuarios y roles, donde también está la tabla completa de Permisos por rol.",
      steps: [
        {
          title: "Administrador",
          text: "Tiene todos los permisos: operación, finanzas, configuración de la empresa, usuarios y roles, suscripción y datos.",
          tip: "Siempre debe quedar al menos un administrador en la empresa.",
        },
        {
          title: "Comercial",
          text: "Ve los datos y gestiona **Pedidos, proyectos y contactos**, puede **Confirmar pedidos**, **Ver márgenes**, y trabajar con **Familias y reglas de carpa**, **Transporte** y **Workflows**.",
        },
        {
          title: "Jefe de almacén",
          text: "Ve los datos y gestiona **Inventario**, **Almacén**, **Mantenimiento**, **Transporte** y **Familias y reglas de carpa**.",
        },
        {
          title: "Jefe de equipo",
          text: "Ve los datos y gestiona la **Planificación de personal**, **Fichaje y partes**, **Transporte** y **Almacén**.",
        },
        {
          title: "Montador",
          text: "Solo tiene **Fichaje y partes**. Trabaja desde la app móvil de campo, no desde el back office.",
        },
        {
          title: "Solo lectura",
          text: "Puede **Ver datos** de las secciones generales, pero no crear ni modificar nada.",
        },
      ],
      notes: [
        "Finanzas (Dashboard, Ventas, Compras y Tesorería), Configuración de la empresa y Usuarios y roles son exclusivos del Administrador con los permisos estándar.",
        "Además de los roles, el administrador puede decidir qué roles ven datos sensibles (margen, costes y coste por hora del personal) en Permisos por campo.",
      ],
    },
  ],
};
