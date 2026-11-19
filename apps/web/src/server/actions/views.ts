"use server";
import { z } from "zod";
import { and, eq, savedViews } from "@rentevent/db";
import { tenantAction } from "../action";

export const saveView = tenantAction(
  z.object({ entity: z.string().min(1).max(40), name: z.string().trim().min(1).max(60), config: z.record(z.string(), z.unknown()) }),
  "ver",
  async (input, tx, ctx) => {
    const [row] = await tx.insert(savedViews).values({ ...input, userId: ctx.user.id }).returning({ id: savedViews.id });
    return { id: row!.id };
  },
);

export const deleteView = tenantAction(z.object({ id: z.string().uuid() }), "ver", async ({ id }, tx, ctx) => {
  await tx.delete(savedViews).where(and(eq(savedViews.id, id), eq(savedViews.userId, ctx.user.id)));
  return { id };
});
