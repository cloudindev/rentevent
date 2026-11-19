/** Pure workflow helpers (conditions and template rendering). */
export const CONDITION_OPS = ["=", "!=", ">", ">=", "<", "<=", "contiene"] as const;
export type ConditionOp = (typeof CONDITION_OPS)[number];
export type Condition = { field: string; op: ConditionOp; value: string | number };

export const CONDITION_FIELDS: Record<string, string> = {
  total: "Total del último presupuesto (€)",
  cliente: "Cliente",
  estado: "Estado del pedido",
  dias_para_carga: "Días hasta la carga",
  dias_para_retorno: "Días hasta el retorno",
  pedido: "Número de pedido",
  titulo: "Título",
};

export const TEMPLATE_VARIABLES = ["cliente", "pedido", "evento", "montaje", "retorno", "empresa", "enlace", "total", "estado"];

const norm = (v: unknown) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
const asNum = (v: unknown) => (typeof v === "number" ? v : v !== "" && v != null && !Number.isNaN(Number(String(v).replace(",", "."))) ? Number(String(v).replace(",", ".")) : null);

export function evaluateCondition(c: Condition, vars: Record<string, string | number>): boolean {
  const left = vars[c.field];
  if (left === undefined) return false;
  const ln = asNum(left);
  const rn = asNum(c.value);
  const numeric = ln !== null && rn !== null;
  switch (c.op) {
    case "=":
      return numeric ? ln === rn : norm(left) === norm(c.value);
    case "!=":
      return numeric ? ln !== rn : norm(left) !== norm(c.value);
    case ">":
      return numeric && ln! > rn!;
    case ">=":
      return numeric && ln! >= rn!;
    case "<":
      return numeric && ln! < rn!;
    case "<=":
      return numeric && ln! <= rn!;
    case "contiene":
      return norm(left).includes(norm(c.value));
  }
}

/** All conditions must hold (AND). No conditions → true. */
export function evaluateConditions(conditions: Condition[], vars: Record<string, string | number>): boolean {
  return conditions.every((c) => evaluateCondition(c, vars));
}

/** Replaces {{variable}} placeholders; unknown variables become empty strings. */
export function renderTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, k: string) => (vars[k] !== undefined ? String(vars[k]) : ""));
}
