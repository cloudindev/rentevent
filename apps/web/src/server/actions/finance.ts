"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, bankAccounts, bankMovements, eq, invoiceSeries, invoices, purchases, subrentals, tenantSettings } from "@rentevent/db";
import { sendEmail, emailLayout, escapeHtml } from "@/lib/adapters/email";
import { tenantAction, UserError, zOptText } from "../action";
import { audit } from "../audit";
import { parseBankCsv, todayMadrid } from "../finance/calc";
import { submitEInvoice } from "../finance/einvoice";
import {
  createBlankInvoice,
  createInvoiceFromOrder,
  createRectification,
  deleteDraftInvoice,
  issueInvoice,
  registerPayment,
  updateDraftInvoice,
  type ClientSnapshot,
} from "../finance/invoicing";
import { renderInvoicePdf } from "../pdf/invoice";

const zIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");
const zLine = z.object({
  description: z.string().trim().max(500),
  quantity: z.coerce.number().min(-1e6).max(1e6),
  unitPrice: z.coerce.number().min(-1e8).max(1e8),
  discountPct: z.coerce.number().min(0).max(100).default(0),
  // any rate the tenant may use (Tarifas allows a general rate of 0–30 %), not just 21/10/4/0
  taxRate: z.coerce.number().min(0, "IVA no válido").max(30, "IVA no válido").transform((v) => Math.round(v * 100) / 100),
});

const refresh = (id?: string) => {
  revalidatePath("/app/ventas");
  revalidatePath("/app/finanzas");
  revalidatePath("/app/tesoreria");
  if (id) revalidatePath(`/app/ventas/${id}`);
};

export const createInvoiceFromOrderAction = tenantAction(
  z.object({ orderId: z.string().uuid(), kind: z.enum(["normal", "anticipo"]), percent: z.coerce.number().min(1).max(100).optional() }),
  "finanzas",
  async (input, tx, ctx) => {
    const inv = await createInvoiceFromOrder(tx, ctx, input);
    refresh();
    return { id: inv.id };
  },
);

export const createBlankInvoiceAction = tenantAction(z.object({ clientId: z.string().uuid().nullable() }), "finanzas", async (input, tx, ctx) => {
  const inv = await createBlankInvoice(tx, ctx, { clientId: input.clientId });
  refresh();
  return { id: inv.id };
});

export const updateDraftInvoiceAction = tenantAction(
  z.object({
    invoiceId: z.string().uuid(),
    clientId: z.string().uuid().nullable(),
    seriesId: z.string().uuid().nullable().optional(),
    lines: z.array(zLine).min(1).max(300),
    notes: zOptText(2000),
    dueDate: zIso.nullable(),
  }),
  "finanzas",
  async (input, tx, ctx) => {
    await updateDraftInvoice(tx, ctx, input);
    refresh(input.invoiceId);
    return null;
  },
);

export const deleteDraftInvoiceAction = tenantAction(z.object({ invoiceId: z.string().uuid() }), "finanzas", async (input, tx, ctx) => {
  await deleteDraftInvoice(tx, ctx, input.invoiceId);
  refresh();
  return null;
});

export const issueInvoiceAction = tenantAction(z.object({ invoiceId: z.string().uuid() }), "finanzas", async (input, tx, ctx) => {
  const inv = await issueInvoice(tx, ctx, input.invoiceId);
  await submitEInvoice(tx, inv.id);
  refresh(inv.id);
  return { fullNumber: inv.fullNumber };
});

export const registerPaymentAction = tenantAction(
  z.object({
    invoiceId: z.string().uuid(),
    amount: z.coerce.number().refine((v) => v !== 0, "El importe no puede ser cero"),
    paidOn: zIso,
    method: z.enum(["transferencia", "tarjeta", "efectivo", "domiciliacion", "bizum", "otro"]),
    bankAccountId: z.string().uuid().nullable(),
    reference: zOptText(120),
    createMovement: z.boolean().default(true),
  }),
  "finanzas",
  async (input, tx, ctx) => {
    await registerPayment(tx, ctx, input);
    refresh(input.invoiceId);
    return null;
  },
);

export const createRectificationAction = tenantAction(
  z.object({ invoiceId: z.string().uuid(), reason: z.string().trim().min(3, "Indica el motivo").max(300) }),
  "finanzas",
  async (input, tx, ctx) => {
    const inv = await createRectification(tx, ctx, input);
    refresh(input.invoiceId);
    return { id: inv.id };
  },
);

export const sendInvoiceEmailAction = tenantAction(
  z.object({ invoiceId: z.string().uuid(), to: z.string().trim().email("Correo no válido"), message: zOptText(2000) }),
  "finanzas",
  async (input, tx, ctx) => {
    const [inv] = await tx.select().from(invoices).where(eq(invoices.id, input.invoiceId));
    if (!inv?.fullNumber) throw new UserError("Emite la factura antes de enviarla");
    const pdf = await renderInvoicePdf(tx, inv.id, ctx.tenantName);
    const [settings] = await tx.select({ legalName: tenantSettings.legalName }).from(tenantSettings);
    const company = settings?.legalName || ctx.tenantName;
    const client = inv.clientSnapshot as ClientSnapshot | null;
    const body = input.message?.trim() || `Hola${client?.name ? ` ${client.name}` : ""},\n\nAdjuntamos la factura ${inv.fullNumber}.\n\nUn saludo,\n${company}`;
    const r = await sendEmail({
      to: input.to,
      subject: `Factura ${inv.fullNumber} · ${company}`,
      html: emailLayout({ title: `Factura ${inv.fullNumber}`, body: `<p>${escapeHtml(body).replace(/\n/g, "<br/>")}</p>`, footer: company }),
      text: body,
      attachments: pdf ? [{ filename: pdf.fileName, content: pdf.buffer, contentType: "application/pdf" }] : undefined,
    });
    await audit(tx, ctx, "invoice", inv.id, "enviar", { a: input.to, modo: r.mode });
    return { mode: r.mode };
  },
);

export const createSeriesAction = tenantAction(
  z.object({
    code: z.string().trim().min(1).max(6).regex(/^[A-Z0-9]+$/, "Solo mayúsculas y números"),
    name: z.string().trim().min(2).max(60),
    kind: z.enum(["normal", "rectificativa", "anticipo"]),
    year: z.coerce.number().int().min(2020).max(2100),
  }),
  "finanzas",
  async (input, tx, ctx) => {
    const [exists] = await tx.select({ id: invoiceSeries.id }).from(invoiceSeries).where(and(eq(invoiceSeries.code, input.code), eq(invoiceSeries.year, input.year)));
    if (exists) throw new UserError(`Ya existe la serie ${input.code} para ${input.year}`);
    const [row] = await tx.insert(invoiceSeries).values({ ...input, nextNumber: 1 }).returning();
    await audit(tx, ctx, "invoice_series", row!.id, "crear", input);
    revalidatePath("/app/ventas");
    return null;
  },
);

// ───────────── Purchases

const purchaseSchema = z.object({
  id: z.string().uuid().nullable(),
  kind: z.enum(["factura", "gasto", "ticket"]),
  supplierId: z.string().uuid().nullable(),
  projectId: z.string().uuid().nullable(),
  subrentalId: z.string().uuid().nullable(),
  number: zOptText(60),
  issueDate: zIso,
  dueDate: zIso.nullable(),
  concept: z.string().trim().min(2, "Indica el concepto").max(300),
  category: z.enum(["general", "subalquiler", "mantenimiento", "transporte", "personal", "material", "seguros", "suministros"]),
  base: z.coerce.number().min(-1e8).max(1e8),
  vatRate: z.coerce.number().min(0, "IVA no válido").max(30, "IVA no válido"),
});

export const savePurchaseAction = tenantAction(purchaseSchema, "finanzas", async (input, tx, ctx) => {
  const vat = Math.round(input.base * input.vatRate) / 100;
  let projectId = input.projectId;
  if (input.subrentalId) {
    const [sub] = await tx.select().from(subrentals).where(eq(subrentals.id, input.subrentalId));
    if (!sub) throw new UserError("Subalquiler no encontrado");
    projectId = projectId ?? sub.projectId;
    // the supplier invoice sets the real cost imputed to the project
    await tx.update(subrentals).set({ cost: input.base }).where(eq(subrentals.id, sub.id));
  }
  const values = {
    kind: input.kind,
    supplierId: input.supplierId,
    projectId,
    subrentalId: input.subrentalId,
    number: input.number,
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    concept: input.concept,
    category: input.subrentalId ? "subalquiler" : input.category,
    base: input.base,
    vat,
    total: Math.round((input.base + vat) * 100) / 100,
  };
  if (input.id) {
    const [before] = await tx.select().from(purchases).where(eq(purchases.id, input.id));
    if (!before) throw new UserError("Compra no encontrada");
    if (before.status === "pagada" && Math.abs(Number(before.total) - values.total) >= 0.005) {
      // the payment's bank movement holds the old amount: don't let the two drift apart silently
      const [mov] = await tx.select({ id: bankMovements.id }).from(bankMovements).where(eq(bankMovements.purchaseId, before.id)).limit(1);
      if (mov) throw new UserError("Esta compra está pagada con un movimiento bancario conciliado: deshaz la conciliación en Tesorería antes de cambiar el importe");
    }
    await tx.update(purchases).set(values).where(eq(purchases.id, input.id));
    await audit(tx, ctx, "purchase", input.id, "editar", { total: { de: before.total, a: values.total } });
  } else {
    const [row] = await tx.insert(purchases).values(values).returning();
    await audit(tx, ctx, "purchase", row!.id, "crear", { concepto: input.concept, total: values.total });
  }
  revalidatePath("/app/compras");
  revalidatePath("/app/finanzas");
  return null;
});

export const deletePurchaseAction = tenantAction(z.object({ id: z.string().uuid() }), "finanzas", async (input, tx, ctx) => {
  const [p] = await tx.select().from(purchases).where(eq(purchases.id, input.id));
  if (!p) throw new UserError("Compra no encontrada");
  if (p.status === "pagada") throw new UserError("No se puede borrar una compra pagada");
  await tx.delete(purchases).where(eq(purchases.id, input.id));
  await audit(tx, ctx, "purchase", input.id, "borrar", { concepto: p.concept });
  revalidatePath("/app/compras");
  return null;
});

export const payPurchaseAction = tenantAction(
  z.object({ id: z.string().uuid(), paidOn: zIso, bankAccountId: z.string().uuid().nullable(), movementId: z.string().uuid().nullable().default(null) }),
  "finanzas",
  async (input, tx, ctx) => {
    const [p] = await tx.select().from(purchases).where(eq(purchases.id, input.id));
    if (!p) throw new UserError("Compra no encontrada");
    if (p.status === "pagada") throw new UserError("Ya está pagada");
    await tx.update(purchases).set({ status: "pagada", paidOn: input.paidOn }).where(eq(purchases.id, p.id));
    if (input.movementId) await tx.update(bankMovements).set({ purchaseId: p.id, reconciled: true }).where(eq(bankMovements.id, input.movementId));
    else if (input.bankAccountId)
      await tx.insert(bankMovements).values({ accountId: input.bankAccountId, bookedOn: input.paidOn, concept: `Pago ${p.concept}`, amount: -Number(p.total), purchaseId: p.id, reconciled: true, category: p.category });
    await audit(tx, ctx, "purchase", p.id, "estado", { pagada: input.paidOn });
    revalidatePath("/app/compras");
    revalidatePath("/app/tesoreria");
    return null;
  },
);

// ───────────── Treasury

export const createBankAccountAction = tenantAction(
  z.object({ name: z.string().trim().min(2).max(80), iban: z.string().trim().max(40).default(""), openingBalance: z.coerce.number(), openingDate: zIso.nullable() }),
  "finanzas",
  async (input, tx, ctx) => {
    const [row] = await tx.insert(bankAccounts).values(input).returning();
    await audit(tx, ctx, "bank_account", row!.id, "crear", { nombre: input.name });
    revalidatePath("/app/tesoreria");
    return { id: row!.id };
  },
);

export const createMovementAction = tenantAction(
  z.object({ accountId: z.string().uuid(), bookedOn: zIso, concept: z.string().trim().min(2).max(200), amount: z.coerce.number().refine((v) => v !== 0, "Importe no válido"), category: zOptText(40), forecast: z.boolean().default(false) }),
  "finanzas",
  async (input, tx, ctx) => {
    const [row] = await tx.insert(bankMovements).values({ ...input, forecast: input.forecast || input.bookedOn > todayMadrid() }).returning();
    await audit(tx, ctx, "bank_movement", row!.id, "crear", { importe: input.amount });
    revalidatePath("/app/tesoreria");
    return null;
  },
);

export const deleteMovementAction = tenantAction(z.object({ id: z.string().uuid() }), "finanzas", async (input, tx, ctx) => {
  const [m] = await tx.select().from(bankMovements).where(eq(bankMovements.id, input.id));
  if (!m) throw new UserError("Movimiento no encontrado");
  if (m.reconciled) throw new UserError("Deshaz la conciliación antes de borrar el movimiento");
  await tx.delete(bankMovements).where(eq(bankMovements.id, m.id));
  await audit(tx, ctx, "bank_movement", m.id, "borrar", { concepto: m.concept, importe: m.amount });
  revalidatePath("/app/tesoreria");
  return null;
});

export const importMovementsAction = tenantAction(z.object({ accountId: z.string().uuid(), csv: z.string().min(1).max(2_000_000) }), "finanzas", async (input, tx, ctx) => {
  const [acc] = await tx.select().from(bankAccounts).where(eq(bankAccounts.id, input.accountId));
  if (!acc) throw new UserError("Cuenta no encontrada");
  const { rows, errors } = parseBankCsv(input.csv);
  if (rows.length === 0) throw new UserError(errors[0] ?? "No se ha encontrado ningún movimiento");
  // skip exact duplicates already in the account
  const existing = await tx.select({ d: bankMovements.bookedOn, c: bankMovements.concept, a: bankMovements.amount }).from(bankMovements).where(eq(bankMovements.accountId, acc.id));
  const key = (d: string, c: string, a: number) => `${d}|${c}|${a.toFixed(2)}`;
  const seen = new Set(existing.map((e) => key(e.d, e.c, Number(e.a))));
  const fresh = rows.filter((r) => !seen.has(key(r.date, r.concept, r.amount)));
  if (fresh.length) await tx.insert(bankMovements).values(fresh.map((r) => ({ accountId: acc.id, bookedOn: r.date, concept: r.concept, amount: r.amount })));
  await audit(tx, ctx, "bank_account", acc.id, "importar", { importados: fresh.length, duplicados: rows.length - fresh.length });
  revalidatePath("/app/tesoreria");
  return { imported: fresh.length, duplicates: rows.length - fresh.length, errors };
});

export const reconcileMovementAction = tenantAction(
  z.object({ movementId: z.string().uuid(), target: z.discriminatedUnion("type", [z.object({ type: z.literal("invoice"), id: z.string().uuid() }), z.object({ type: z.literal("purchase"), id: z.string().uuid() }), z.object({ type: z.literal("none"), category: z.string().trim().min(1).max(40) })]) }),
  "finanzas",
  async (input, tx, ctx) => {
    const [m] = await tx.select().from(bankMovements).where(eq(bankMovements.id, input.movementId));
    if (!m) throw new UserError("Movimiento no encontrado");
    if (m.reconciled) throw new UserError("El movimiento ya está conciliado");
    const t = input.target;
    if (t.type === "invoice") {
      if (Number(m.amount) <= 0) throw new UserError("Un cobro debe ser un movimiento positivo");
      await registerPayment(tx, ctx, { invoiceId: t.id, amount: Number(m.amount), paidOn: m.bookedOn, method: "transferencia", bankAccountId: m.accountId, reference: m.concept, createMovement: false, movementId: m.id });
    } else if (t.type === "purchase") {
      const [p] = await tx.select().from(purchases).where(eq(purchases.id, t.id));
      if (!p) throw new UserError("Compra no encontrada");
      await tx.update(purchases).set({ status: "pagada", paidOn: m.bookedOn }).where(eq(purchases.id, p.id));
      await tx.update(bankMovements).set({ purchaseId: p.id, reconciled: true, category: p.category }).where(eq(bankMovements.id, m.id));
    } else {
      await tx.update(bankMovements).set({ reconciled: true, category: t.category }).where(eq(bankMovements.id, m.id));
    }
    await audit(tx, ctx, "bank_movement", m.id, "editar", { conciliado: t });
    revalidatePath("/app/tesoreria");
    revalidatePath("/app/ventas");
    revalidatePath("/app/compras");
    return null;
  },
);

export const unreconcileMovementAction = tenantAction(z.object({ movementId: z.string().uuid() }), "finanzas", async (input, tx, ctx) => {
  const [m] = await tx.select().from(bankMovements).where(eq(bankMovements.id, input.movementId));
  if (!m) throw new UserError("Movimiento no encontrado");
  if (m.invoiceId) throw new UserError("Los cobros de facturas se corrigen con un cobro negativo desde la factura");
  if (m.purchaseId) await tx.update(purchases).set({ status: "pendiente", paidOn: null }).where(eq(purchases.id, m.purchaseId));
  await tx.update(bankMovements).set({ reconciled: false, purchaseId: null }).where(eq(bankMovements.id, m.id));
  await audit(tx, ctx, "bank_movement", m.id, "editar", { conciliado: false });
  revalidatePath("/app/tesoreria");
  return null;
});
