import "server-only";
import { and, asc, eq, savedViews, type Tx } from "@rentevent/db";
import type { SavedView, ViewConfig } from "@/components/app/data-table";

export async function loadViews(tx: Tx, userId: string, entity: string): Promise<SavedView[]> {
  const rows = await tx.select().from(savedViews).where(and(eq(savedViews.userId, userId), eq(savedViews.entity, entity))).orderBy(asc(savedViews.name));
  return rows.map((r) => ({ id: r.id, name: r.name, config: r.config as ViewConfig }));
}
