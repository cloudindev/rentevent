"use server";
import { z } from "zod";
import { describeMaxLengths, maxLengthByFamily, zonedTime, type Anchoring } from "@rentevent/core";
import { availableMap } from "@rentevent/db/services";
import { loadCatalog } from "../catalog";
import { tenantAction } from "../action";

/** "del 12 al 15 de diciembre puedes montar hasta 10x35 o 15x20 alta". */
export const reverseAvailability = tenantAction(
  z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), anchoring: z.enum(["anclaje", "pesos"]) }),
  "ver",
  async (input, tx) => {
    const [y1, m1, d1] = input.from.split("-").map(Number) as [number, number, number];
    const [y2, m2, d2] = input.to.split("-").map(Number) as [number, number, number];
    const range = { start: new Date(zonedTime(y1, m1, d1, 0)), end: new Date(zonedTime(y2, m2, d2, 23, 59)) };
    const cat = await loadCatalog(tx);
    const avail = await availableMap(tx, cat.items.map((i) => i.id), range);
    const results = maxLengthByFamily(cat, avail, input.anchoring as Anchoring);
    return { results: results.map((r) => ({ ...r, limitingItem: r.limitingItemId ? cat.items.find((i) => i.id === r.limitingItemId)?.name ?? null : null })), summary: describeMaxLengths(results) };
  },
);
