"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { eq, workflows } from "@rentevent/db";
import { audit } from "../audit";
import { tenantAction, UserError } from "../action";
import { getAppContext } from "../context";
import { can } from "@/lib/permissions";
import { CONDITION_OPS, runWorkflowById } from "../workflows";

const channel = z.enum(["push", "email", "whatsapp", "interno"]);
const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("caducar_opciones") }),
  z.object({ type: z.literal("avisar_escasez"), channel, to: z.string().trim().min(2, "Indica el destinatario").max(160) }),
  z.object({ type: z.literal("enviar_plantilla"), template: z.string().min(1, "Elige una plantilla"), to: z.string().trim().max(160).optional() }),
  z.object({ type: z.literal("publicar_planning"), channel }),
  z.object({ type: z.literal("notificar"), channel, to: z.string().trim().min(2, "Indica el destinatario").max(160), title: z.string().trim().min(2).max(120), body: z.string().trim().min(2).max(1000) }),
]);

const workflowInput = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(2, "Pon un nombre").max(80),
  trigger: z.enum(["pedido_creado", "pedido_confirmado", "opcion_por_caducar", "escasez_detectada", "devolucion_manana", "diario", "semanal"]),
  conditions: z.array(z.object({ field: z.string().min(1), op: z.enum(CONDITION_OPS), value: z.union([z.string().max(120), z.number()]) })).max(10),
  action: actionSchema,
  active: z.boolean(),
});

export const saveWorkflow = tenantAction(workflowInput, "automatizaciones", async (input, tx, ctx) => {
  const { id, ...values } = input;
  if (id) {
    const [row] = await tx.update(workflows).set(values).where(eq(workflows.id, id)).returning({ id: workflows.id });
    if (!row) throw new UserError("Workflow no encontrado");
    await audit(tx, ctx, "workflow", id, "editar", { nombre: values.name });
  } else {
    const [row] = await tx.insert(workflows).values(values).returning({ id: workflows.id });
    await audit(tx, ctx, "workflow", row!.id, "crear", { nombre: values.name });
  }
  revalidatePath("/app/workflows");
  return { ok: true };
});

export const toggleWorkflow = tenantAction(z.object({ id: z.string().uuid(), active: z.boolean() }), "automatizaciones", async ({ id, active }, tx, ctx) => {
  await tx.update(workflows).set({ active }).where(eq(workflows.id, id));
  await audit(tx, ctx, "workflow", id, "estado", { activo: active });
  revalidatePath("/app/workflows");
  return { id };
});

export const deleteWorkflow = tenantAction(z.object({ id: z.string().uuid() }), "automatizaciones", async ({ id }, tx, ctx) => {
  await tx.delete(workflows).where(eq(workflows.id, id));
  await audit(tx, ctx, "workflow", id, "borrar");
  revalidatePath("/app/workflows");
  return { id };
});

export async function runWorkflowNow(id: string): Promise<{ ok: true; summary: string } | { ok: false; error: string }> {
  const ctx = await getAppContext();
  if (!ctx) return { ok: false, error: "Tu sesión ha caducado." };
  if (!can(ctx.role, "automatizaciones")) return { ok: false, error: "No tienes permiso para ejecutar workflows." };
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Workflow no válido" };
  try {
    const res = await runWorkflowById(ctx.tenantId, id, null);
    revalidatePath("/app/workflows");
    const ok = res.filter((r) => r.status === "ok").length;
    const err = res.filter((r) => r.status === "error").length;
    return { ok: true, summary: ok ? `${ok} ejecución(es) correcta(s)${err ? `, ${err} con error` : ""}: ${res.find((r) => r.status === "ok")?.detail ?? ""}` : res[0]?.detail ?? "Nada que hacer" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error al ejecutar" };
  }
}
