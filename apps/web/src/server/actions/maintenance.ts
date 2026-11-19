"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tenantAction } from "../action";
import { openRepair, recordInspection as recordInspectionSvc, setRepairStatus as setRepairStatusSvc } from "../warehouse/maintenance";

const id = z.string().uuid();
const refresh = (itemId?: string) => {
  revalidatePath("/app/mantenimiento");
  revalidatePath("/app/mantenimiento/revisiones");
  revalidatePath("/app/mantenimiento/limpieza");
  if (itemId) revalidatePath(`/app/inventario/${itemId}`);
};

export const createRepair = tenantAction(
  z.object({ itemId: id, unitId: id.nullable(), quantity: z.number().positive().max(1e5), kind: z.enum(["reparacion", "limpieza"]), reason: z.string().trim().min(3, "Describe el motivo").max(500) }),
  "mantenimiento",
  async (input, tx, ctx) => {
    const repairId = await openRepair(tx, ctx, input);
    refresh(input.itemId);
    return { id: repairId };
  },
);

export const setRepairStatus = tenantAction(
  z.object({ id, status: z.enum(["pendiente", "en_curso", "reparado", "baja"]), cost: z.number().min(0).max(1e6).optional(), resolution: z.string().trim().max(500).nullable().optional() }),
  "mantenimiento",
  async (input, tx, ctx) => {
    await setRepairStatusSvc(tx, ctx, input);
    refresh();
    return { ok: true };
  },
);

export const recordInspection = tenantAction(
  z.object({ itemId: id, unitId: id.nullable(), result: z.enum(["ok", "defectos", "no_apto"]), notes: z.string().trim().max(1000).nullable(), quantity: z.number().int().min(1).max(1e5).optional() }),
  "mantenimiento",
  async (input, tx, ctx) => {
    const r = await recordInspectionSvc(tx, ctx, { ...input, inspector: ctx.user.name });
    refresh(input.itemId);
    return { repairId: r.repairId, nextDueAt: r.nextDueAt?.toISOString() ?? null };
  },
);
