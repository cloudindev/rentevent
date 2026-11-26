import "server-only";
import { addDays, dayKey } from "@rentevent/core";
import { env } from "../env";
import type { AppContext } from "@/server/context";
import { detectIntent, type DateRange } from "@/server/ai/intent";
import { runTool, toolDefinitionsFor, type ToolResult } from "@/server/ai/tools";

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type AssistantReply = { text: string; links: { label: string; href: string }[]; toolCalls: { name: string; input: unknown; error?: string }[]; provider: "anthropic" | "simulado" };

export const aiProvider = (): "anthropic" | "simulado" => (env.anthropicKey ? "anthropic" : "simulado");

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2026-10-21";
/** Models that accept the server-side refusal fallback parameter. */
const FALLBACK_MODELS = new Set(["claude-fable-5-2", "claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);
const MAX_TOOL_ROUNDS = 8;

function systemPrompt(ctx: AppContext) {
  const today = dayKey(Date.now());
  return [
    `Eres el asistente de ${ctx.tenantName}, una empresa de alquiler y montaje de carpas para eventos, dentro de la aplicación Rentevent.`,
    `Hoy es ${today} (zona horaria Europe/Madrid). Responde siempre en español, de forma breve y concreta.`,
    "Usa las herramientas para cualquier dato de stock, personal, pedidos o facturación: no inventes cifras. Convierte las fechas que diga el usuario a YYYY-MM-DD; si no da año, usa el próximo que corresponda.",
    "Las carpas se definen por familia (ancho y pata alta o baja) y largo en módulos de 5 m; las cerchas son el material crítico.",
    "Solo crea pedidos cuando el usuario lo pida expresamente; se crean como borrador y no reservan material.",
    "Puedes enlazar registros con enlaces markdown relativos como [Pedido 262041](/app/pedidos/<id>) usando los enlaces que devuelven las herramientas.",
  ].join("\n");
}

type ContentBlock = { type: string; text?: string; id?: string; name?: string; input?: unknown; [k: string]: unknown };
type ApiResponse = { content: ContentBlock[]; stop_reason: string | null; stop_details?: { category?: string | null } | null };

async function callApi(body: Record<string, unknown>, fallback: boolean): Promise<ApiResponse> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.anthropicKey!,
      "anthropic-version": API_VERSION,
      ...(fallback ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Claude API ${res.status}: ${detail.slice(0, 300)}`);
  }
  return (await res.json()) as ApiResponse;
}

/** Manual Messages API tool-use loop with plain fetch. */
async function runAnthropic(ctx: AppContext, history: ChatTurn[], userText: string): Promise<AssistantReply> {
  const model = env.aiModel;
  const fallback = FALLBACK_MODELS.has(model);
  const messages: { role: "user" | "assistant"; content: unknown }[] = [...history.map((h) => ({ role: h.role, content: h.content })), { role: "user", content: userText }];
  const links: AssistantReply["links"] = [];
  const toolCalls: AssistantReply["toolCalls"] = [];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await callApi(
      {
        model,
        max_tokens: 16000,
        system: systemPrompt(ctx),
        tools: toolDefinitionsFor(ctx.role),
        tool_choice: { type: "auto" },
        output_config: { effort: "medium" },
        messages,
        ...(fallback ? { fallbacks: "default" } : {}),
      },
      fallback,
    );
    if (response.stop_reason === "refusal") {
      return { text: "No puedo ayudarte con esa petición. Prueba a reformularla sobre carpas, stock, personal, pedidos o facturación.", links, toolCalls, provider: "anthropic" };
    }
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n")
      .trim();
    if (response.stop_reason === "tool_use") {
      // keep the assistant turn exactly as returned (incl. thinking blocks)
      messages.push({ role: "assistant", content: response.content });
      const uses = response.content.filter((b) => b.type === "tool_use");
      const results = await Promise.all(
        uses.map(async (u) => {
          try {
            const r = await runTool(ctx, u.name!, u.input);
            toolCalls.push({ name: u.name!, input: u.input });
            links.push(...(r.links ?? []));
            return { type: "tool_result", tool_use_id: u.id!, content: JSON.stringify({ resumen: r.text, datos: r.data ?? null, enlaces: r.links ?? [] }) };
          } catch (e) {
            toolCalls.push({ name: u.name!, input: u.input, error: String(e) });
            return { type: "tool_result", tool_use_id: u.id!, content: e instanceof Error ? e.message : String(e), is_error: true };
          }
        }),
      );
      // all tool results go back in a single user message
      messages.push({ role: "user", content: results });
      continue;
    }
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    const suffix = response.stop_reason === "max_tokens" ? "\n\n(Respuesta cortada por longitud.)" : "";
    return { text: (text || "Hecho.") + suffix, links: dedupe(links), toolCalls, provider: "anthropic" };
  }
  return { text: "He necesitado demasiados pasos para responder. Prueba con una pregunta más concreta.", links: dedupe(links), toolCalls, provider: "anthropic" };
}

const dedupe = (l: AssistantReply["links"]) => l.filter((x, i) => l.findIndex((y) => y.href === x.href) === i);

const HELP =
  "Puedo ayudarte con:\n\n- **Qué carpa puedes montar** en unas fechas: «¿Qué carpa puedo montar del 12 al 15 de diciembre?»\n- **Personal libre**: «¿Quién está libre el sábado 12 de diciembre?»\n- **Stock de un artículo**: «¿Cuántas cerchas de 10 m hay libres el 12 de diciembre?»\n- **Pedidos de un periodo**: «Pedidos de esta semana»\n- **Facturación**: «¿Cuánto hemos facturado este mes?»\n- **Crear un borrador**: «Crea un pedido de una carpa 10x20 para el 12 de diciembre para Hotel Playa Mayor»";

/** Deterministic Spanish intent parser that uses the same tools. */
async function runSimulated(ctx: AppContext, userText: string): Promise<AssistantReply> {
  const intent = detectIntent(userText);
  const today = dayKey(Date.now());
  const r = (range: DateRange | null, days = 0): DateRange => range ?? { from: today, to: addDays(today, days) };
  let call: { name: string; input: Record<string, unknown> } | null = null;
  let prefix = "";
  switch (intent.kind) {
    case "largo_maximo": {
      const range = r(intent.range);
      call = { name: "largo_maximo", input: { desde: range.from, hasta: range.to, fijacion: intent.anchoring } };
      if (!intent.range) prefix = "No has indicado fechas, así que miro hoy. ";
      break;
    }
    case "personal_libre": {
      const range = r(intent.range);
      call = { name: "personal_libre", input: { fecha: range.from } };
      break;
    }
    case "disponibilidad": {
      const range = r(intent.range);
      call = { name: "consultar_disponibilidad", input: { item: intent.item, desde: range.from, hasta: range.to } };
      break;
    }
    case "pedidos_periodo": {
      const range = r(intent.range, 6);
      call = { name: "pedidos_periodo", input: { desde: range.from, hasta: range.to } };
      break;
    }
    case "resumen_facturacion": {
      const range = r(intent.range);
      call = { name: "resumen_facturacion", input: { mes: range.from.slice(0, 7) } };
      break;
    }
    case "crear_borrador": {
      if (!intent.width || !intent.length) {
        return { text: "Para crear el borrador necesito la medida de la carpa, por ejemplo «una carpa 10x20», y la fecha del evento.", links: [], toolCalls: [], provider: "simulado" };
      }
      const event = intent.range?.from ?? addDays(today, 14);
      call = {
        name: "crear_borrador_pedido",
        input: {
          titulo: `Carpa ${intent.width}x${intent.length}${intent.client ? ` · ${intent.client.replace(/\b\w/g, (c) => c.toUpperCase())}` : ""}`,
          cliente: intent.client,
          familia: `${intent.width} m${intent.height ? ` pata ${intent.height}` : ""}`,
          largo_m: intent.length,
          fecha_montaje: addDays(event, -1),
          fecha_evento: event,
          fecha_retorno: addDays(intent.range?.to ?? event, 1),
        },
      };
      break;
    }
    default:
      return { text: HELP, links: [], toolCalls: [], provider: "simulado" };
  }
  try {
    const res: ToolResult = await runTool(ctx, call.name, call.input);
    return { text: prefix + res.text, links: res.links ?? [], toolCalls: [{ name: call.name, input: call.input }], provider: "simulado" };
  } catch (e) {
    return { text: `No he podido consultarlo: ${e instanceof Error ? e.message : String(e)}`, links: [], toolCalls: [{ name: call.name, input: call.input, error: String(e) }], provider: "simulado" };
  }
}

export async function runAssistant(ctx: AppContext, history: ChatTurn[], userText: string): Promise<AssistantReply> {
  if (aiProvider() === "anthropic") {
    try {
      return await runAnthropic(ctx, history.slice(-20), userText);
    } catch (e) {
      console.error(e);
      const sim = await runSimulated(ctx, userText);
      return { ...sim, text: `${sim.text}\n\n_(El proveedor de IA no respondió; contestado en modo simulado.)_` };
    }
  }
  return runSimulated(ctx, userText);
}
