export type LegalDoc = { slug: string; title: string; updated: string; sections: { h: string; p: string[] }[] };

const OWNER = "Rentevent (en adelante, «el Titular»)";

export const LEGAL: LegalDoc[] = [
  {
    slug: "aviso-legal",
    title: "Aviso legal",
    updated: "2026-11-01",
    sections: [
      { h: "Datos identificativos", p: [`En cumplimiento de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se informa de que este sitio web es titularidad de ${OWNER}, con domicilio en Asturias (España) y correo de contacto legal@rentevent.es. Los datos registrales completos se facilitarán a quien los solicite en esa dirección.`] },
      { h: "Objeto", p: ["Este sitio informa sobre Rentevent, un software como servicio para empresas de alquiler y montaje de carpas y estructuras para eventos, y permite contratar el servicio y acceder a él."] },
      { h: "Propiedad intelectual e industrial", p: ["Los textos, diseños, logotipos, código e ilustraciones de este sitio pertenecen al Titular o a sus licenciantes. Queda prohibida su reproducción, distribución o transformación sin autorización expresa, salvo para uso personal y privado."] },
      { h: "Responsabilidad", p: ["El Titular no se hace responsable de los daños derivados del uso indebido del sitio ni de los contenidos de sitios de terceros enlazados. Los ejemplos, cifras y casos mostrados son ilustrativos."] },
      { h: "Legislación y jurisdicción", p: ["Este aviso se rige por la legislación española. Para cualquier controversia, las partes se someten a los juzgados y tribunales que correspondan conforme a la normativa aplicable en materia de consumidores, o en su defecto a los de Oviedo."] },
    ],
  },
  {
    slug: "privacidad",
    title: "Política de privacidad",
    updated: "2026-11-01",
    sections: [
      { h: "Responsable del tratamiento", p: [`${OWNER}. Contacto del delegado de protección de datos: privacidad@rentevent.es.`] },
      { h: "Qué datos tratamos", p: ["Datos de contacto que nos facilitas en formularios (nombre, correo, empresa, teléfono), datos de la cuenta y de uso del servicio, y datos técnicos de navegación necesarios para la seguridad del sitio.", "Los datos que tus clientes y trabajadores introducen en Rentevent los tratamos como encargados del tratamiento por cuenta de tu empresa, conforme al contrato de encargo incluido en los Términos."] },
      { h: "Finalidades y base jurídica", p: ["Prestar el servicio contratado (ejecución del contrato); atender solicitudes de demo y contacto (consentimiento y medidas precontractuales); enviar comunicaciones sobre el servicio (interés legítimo); cumplir obligaciones legales, fiscales y de facturación (obligación legal)."] },
      { h: "Conservación", p: ["Mientras dure la relación y, después, durante los plazos legales de prescripción. Los datos de solicitudes de demo no convertidas se suprimen a los doce meses."] },
      { h: "Destinatarios y transferencias", p: ["Proveedores de alojamiento, correo y pagos con los que hemos firmado contratos de encargo. Los datos se alojan en la Unión Europea. Si algún proveedor tratase datos fuera del EEE, lo haría con garantías adecuadas como las cláusulas contractuales tipo."] },
      { h: "Tus derechos", p: ["Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad escribiendo a privacidad@rentevent.es. Desde la aplicación, los administradores pueden exportar y borrar los datos de su empresa. También puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es)."] },
    ],
  },
  {
    slug: "cookies",
    title: "Política de cookies",
    updated: "2026-11-01",
    sections: [
      { h: "Qué son las cookies", p: ["Pequeños archivos que el sitio guarda en tu navegador para recordar información entre visitas."] },
      { h: "Cookies que usamos", p: ["Necesarias: sesión de usuario (rv.session_token), empresa activa (rv_tenant), idioma (rv_locale) y tus preferencias de cookies (rv_consent). No requieren consentimiento.", "Analítica (opcional): medición anónima de visitas para mejorar el sitio. Solo se activan si las aceptas.", "Marketing (opcional): medición de campañas. Solo se activan si las aceptas."] },
      { h: "Cómo cambiar tu elección", p: ["Puedes cambiar tus preferencias en cualquier momento desde el enlace «Configurar cookies» al pie de cada página, o borrar las cookies desde la configuración de tu navegador."] },
    ],
  },
  {
    slug: "terminos",
    title: "Términos y condiciones",
    updated: "2026-11-01",
    sections: [
      { h: "Objeto", p: ["Estos términos regulan la contratación y el uso de Rentevent por empresas y profesionales. Al crear una cuenta los aceptas en nombre de tu empresa."] },
      { h: "Prueba gratuita y suscripción", p: ["La prueba dura 14 días e incluye todas las funciones. Después, el servicio se presta mediante suscripción mensual o anual según el plan elegido. Los precios no incluyen IVA. Puedes cancelar en cualquier momento; la cancelación surte efecto al final del periodo pagado."] },
      { h: "Uso aceptable", p: ["No está permitido usar el servicio para fines ilícitos, intentar acceder a datos de otras empresas, sobrecargar la plataforma ni revender el acceso sin autorización."] },
      { h: "Tus datos", p: ["Los datos que introduces son tuyos. Puedes exportarlos en cualquier momento. Rentevent actúa como encargado del tratamiento respecto a los datos personales de tus clientes y trabajadores, con las garantías del artículo 28 del RGPD."] },
      { h: "Disponibilidad y soporte", p: ["Trabajamos para mantener una disponibilidad del 99,5 % mensual, con copias de seguridad diarias. El soporte se presta en español por los canales de cada plan."] },
      { h: "Responsabilidad", p: ["Rentevent ayuda a calcular despieces, disponibilidad y planificaciones con los datos que configura cada empresa. La empresa es responsable de validar las cantidades de su fabricante y de cumplir la normativa técnica y laboral aplicable a sus montajes."] },
      { h: "Ley aplicable", p: ["Legislación española. Juzgados de Oviedo, salvo norma imperativa en contrario."] },
    ],
  },
];
