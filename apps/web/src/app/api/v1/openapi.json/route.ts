import { WEBHOOK_EVENTS } from "@/server/api/webhooks";

const err = { $ref: "#/components/schemas/Error" };
const paged = (item: string) => ({ type: "object", properties: { data: { type: "array", items: { $ref: `#/components/schemas/${item}` } }, next_cursor: { type: ["string", "null"] } } });
const listParams = [
  { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
  { name: "cursor", in: "query", schema: { type: "string" }, description: "Valor de next_cursor de la página anterior" },
];
const errors = { "401": { description: "Sin clave o clave no válida", content: { "application/json": { schema: err } } }, "429": { description: "Límite de peticiones", content: { "application/json": { schema: err } } } };

const spec = {
  openapi: "3.1.0",
  info: { title: "Rentevent API", version: "1.0.0", description: "API pública de Rentevent. Autenticación con `Authorization: Bearer rv_live_…` (crea la clave en Configuración › API). Límite: 120 peticiones por ráfaga, 2/s sostenidas por clave." },
  servers: [{ url: "/api/v1" }],
  security: [{ bearer: [] }],
  components: {
    securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
    schemas: {
      Error: { type: "object", properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, details: {} } } } },
      Item: { type: "object", properties: { id: { type: "string", format: "uuid" }, sku: { type: "string" }, name: { type: "string" }, category: { type: "string" }, unit: { type: "string" }, stock_total: { type: "number" }, stock_repair: { type: "number" }, price: { type: "number" }, price_mode: { type: "string" } } },
      Contact: { type: "object", properties: { id: { type: "string", format: "uuid" }, kind: { enum: ["cliente", "proveedor", "localizacion"] }, name: { type: "string" }, tax_id: { type: ["string", "null"] }, email: { type: ["string", "null"] }, phone: { type: ["string", "null"] } } },
      Order: { type: "object", properties: { id: { type: "string", format: "uuid" }, number: { type: "string" }, title: { type: "string" }, status: { enum: ["borrador", "consulta", "opcion", "confirmado", "en_curso", "devuelto", "cancelado"] }, period_start: { type: "string", format: "date-time" }, period_end: { type: "string", format: "date-time" } } },
      TentConfiguration: { type: "object", description: "Esquema TentConfiguration v1 (familyId, modules, anchoring, bays[], fronts, floors, interior)", required: ["version", "familyId", "modules", "anchoring", "bays", "fronts", "floors", "interior"] },
    },
  },
  paths: {
    "/items": { get: { summary: "Lista artículos", parameters: listParams, responses: { "200": { description: "OK", content: { "application/json": { schema: paged("Item") } } }, ...errors } } },
    "/items/{id}/availability": {
      get: {
        summary: "Disponibilidad de un artículo (pico de ocupación en el rango)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "from", in: "query", required: true, schema: { type: "string", format: "date-time" } }, { name: "to", in: "query", required: true, schema: { type: "string", format: "date-time" } }],
        responses: { "200": { description: "OK" }, "400": { description: "Rango no válido" }, "404": { description: "No encontrado" }, ...errors },
      },
    },
    "/contacts": {
      get: { summary: "Lista contactos", parameters: listParams, responses: { "200": { description: "OK", content: { "application/json": { schema: paged("Contact") } } }, ...errors } },
      post: { summary: "Crea un contacto", requestBody: { content: { "application/json": { schema: { type: "object", required: ["name"], properties: { name: { type: "string" }, kind: { type: "string" }, tax_id: { type: "string" }, email: { type: "string" }, phone: { type: "string" } } } } } }, responses: { "201": { description: "Creado" }, "422": { description: "Validación" }, ...errors } },
    },
    "/orders": {
      get: { summary: "Lista pedidos", parameters: [...listParams, { name: "status", in: "query", schema: { type: "string" } }], responses: { "200": { description: "OK", content: { "application/json": { schema: paged("Order") } } }, ...errors } },
      post: { summary: "Crea un pedido en borrador", requestBody: { content: { "application/json": { schema: { type: "object", required: ["title", "load_at", "event_start", "event_end", "return_at"], properties: { title: { type: "string" }, client_id: { type: "string" }, load_at: { type: "string", format: "date-time" }, event_start: { type: "string", format: "date-time" }, event_end: { type: "string", format: "date-time" }, return_at: { type: "string", format: "date-time" } } } } } }, responses: { "201": { description: "Creado" }, "422": { description: "Validación" }, ...errors } },
    },
    "/orders/{id}": { get: { summary: "Detalle de pedido con líneas", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "OK" }, "404": { description: "No encontrado" }, ...errors } } },
    "/families": { get: { summary: "Familias de carpa y reglas de despiece", responses: { "200": { description: "OK" }, ...errors } } },
    "/bom": { post: { summary: "Calcula el despiece de una configuración", requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/TentConfiguration" } } } }, responses: { "200": { description: "Despiece" }, "422": { description: "Configuración no válida" }, ...errors } } },
  },
  webhooks: Object.fromEntries(
    WEBHOOK_EVENTS.map((e) => [e, { post: { summary: `Evento ${e}. Firma: cabecera X-Rentevent-Signature = t=<ts>,v1=HMAC-SHA256(secreto, "<ts>.<cuerpo>")`, responses: { "200": { description: "Recibido" } } } }]),
  ),
};

export function GET() {
  return Response.json(spec, { headers: { "Cache-Control": "public, max-age=300" } });
}
