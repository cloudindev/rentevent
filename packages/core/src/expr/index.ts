/**
 * Safe expression language for BOM rules.
 *
 * Formulas are tokenised and parsed into an AST by hand and evaluated by a
 * tree-walking interpreter. Nothing is ever passed to `eval` or `Function`.
 *
 * Supported syntax (Spanish and English keywords are accepted):
 *   numbers: 1, 2.5        strings: 'pesos', "anclaje"
 *   arithmetic: + - * / % ^      comparison: = == != <> < <= > >=
 *   logic: y/and/&&  o/or/||  no/not/!     ternary: cond ? a : b
 *   functions: si/if(c,a,b), min, max, redondear/round, techo/ceil,
 *              suelo/floor, abs
 *   identifiers may contain dots: laterales.transparente
 */

export type Value = number | string | boolean;
export type Scope = Record<string, Value>;

export class FormulaError extends Error {
  constructor(
    message: string,
    public readonly position: number,
  ) {
    super(message);
    this.name = "FormulaError";
  }
}

type Token =
  | { kind: "num"; value: number; pos: number }
  | { kind: "str"; value: string; pos: number }
  | { kind: "id"; value: string; pos: number }
  | { kind: "op"; value: string; pos: number }
  | { kind: "eof"; pos: number };

const MAX_LENGTH = 500;
const MAX_DEPTH = 40;

const WORD_OPS: Record<string, string> = {
  y: "&&",
  and: "&&",
  o: "||",
  or: "||",
  no: "!",
  not: "!",
  verdadero: "true",
  true: "true",
  falso: "false",
  false: "false",
};

const isIdStart = (c: string) => /[A-Za-z_À-ſ]/.test(c);
const isIdPart = (c: string) => /[A-Za-z0-9_.À-ſ]/.test(c);

export function tokenize(src: string): Token[] {
  if (src.length > MAX_LENGTH) throw new FormulaError(`La fórmula supera ${MAX_LENGTH} caracteres`, MAX_LENGTH);
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      const start = i;
      while (i < src.length && /[0-9.]/.test(src[i]!)) i++;
      const raw = src.slice(start, i);
      if ((raw.match(/\./g) ?? []).length > 1) throw new FormulaError(`Número no válido "${raw}"`, start);
      tokens.push({ kind: "num", value: Number(raw), pos: start });
      continue;
    }
    if (c === "'" || c === '"') {
      const start = i;
      i++;
      let s = "";
      while (i < src.length && src[i] !== c) s += src[i++];
      if (i >= src.length) throw new FormulaError("Texto sin cerrar", start);
      i++;
      tokens.push({ kind: "str", value: s, pos: start });
      continue;
    }
    if (isIdStart(c)) {
      const start = i;
      while (i < src.length && isIdPart(src[i]!)) i++;
      const word = src.slice(start, i);
      const lower = word.toLowerCase();
      const op = Object.prototype.hasOwnProperty.call(WORD_OPS, lower) ? WORD_OPS[lower] : undefined;
      if (op === "true" || op === "false") tokens.push({ kind: "id", value: op, pos: start });
      else if (op) tokens.push({ kind: "op", value: op, pos: start });
      else tokens.push({ kind: "id", value: word, pos: start });
      continue;
    }
    const two = src.slice(i, i + 2);
    if (["==", "!=", "<>", "<=", ">=", "&&", "||"].includes(two)) {
      tokens.push({ kind: "op", value: two === "<>" ? "!=" : two, pos: i });
      i += 2;
      continue;
    }
    if ("+-*/%^()<>=!?:,".includes(c)) {
      tokens.push({ kind: "op", value: c === "=" ? "==" : c, pos: i });
      i++;
      continue;
    }
    throw new FormulaError(`Carácter no permitido "${c}"`, i);
  }
  tokens.push({ kind: "eof", pos: src.length });
  return tokens;
}

export type Node =
  | { type: "num"; value: number }
  | { type: "str"; value: string }
  | { type: "bool"; value: boolean }
  | { type: "var"; name: string; pos: number }
  | { type: "unary"; op: string; arg: Node }
  | { type: "binary"; op: string; left: Node; right: Node }
  | { type: "cond"; test: Node; then: Node; else: Node }
  | { type: "call"; name: string; args: Node[]; pos: number };

export function parse(src: string): Node {
  const tokens = tokenize(src);
  let p = 0;
  let depth = 0;
  const peek = () => tokens[p]!;
  const next = () => tokens[p++]!;
  const isOp = (v: string) => {
    const t = peek();
    return t.kind === "op" && t.value === v;
  };
  const expect = (v: string) => {
    const t = next();
    if (t.kind !== "op" || t.value !== v) throw new FormulaError(`Se esperaba "${v}"`, t.pos);
  };
  const enter = () => {
    if (++depth > MAX_DEPTH) throw new FormulaError("Fórmula demasiado anidada", peek().pos);
  };

  function ternary(): Node {
    enter();
    const test = or();
    if (isOp("?")) {
      next();
      const a = ternary();
      expect(":");
      const b = ternary();
      depth--;
      return { type: "cond", test, then: a, else: b };
    }
    depth--;
    return test;
  }
  function or(): Node {
    let left = and();
    while (isOp("||")) {
      next();
      left = { type: "binary", op: "||", left, right: and() };
    }
    return left;
  }
  function and(): Node {
    let left = not();
    while (isOp("&&")) {
      next();
      left = { type: "binary", op: "&&", left, right: not() };
    }
    return left;
  }
  function not(): Node {
    if (isOp("!")) {
      next();
      enter();
      const arg = not();
      depth--;
      return { type: "unary", op: "!", arg };
    }
    return cmp();
  }
  function cmp(): Node {
    const left = add();
    const t = peek();
    if (t.kind === "op" && ["==", "!=", "<", "<=", ">", ">="].includes(t.value)) {
      next();
      return { type: "binary", op: t.value, left, right: add() };
    }
    return left;
  }
  function add(): Node {
    let left = mul();
    for (;;) {
      const t = peek();
      if (t.kind === "op" && (t.value === "+" || t.value === "-")) {
        next();
        left = { type: "binary", op: t.value, left, right: mul() };
      } else return left;
    }
  }
  function mul(): Node {
    let left = unary();
    for (;;) {
      const t = peek();
      if (t.kind === "op" && (t.value === "*" || t.value === "/" || t.value === "%")) {
        next();
        left = { type: "binary", op: t.value, left, right: unary() };
      } else return left;
    }
  }
  function unary(): Node {
    if (isOp("-") || isOp("+")) {
      const op = next() as { value: string };
      enter();
      const arg = unary();
      depth--;
      return op.value === "-" ? { type: "unary", op: "-", arg } : arg;
    }
    return pow();
  }
  function pow(): Node {
    const base = primary();
    if (isOp("^")) {
      next();
      enter();
      const exp = unary();
      depth--;
      return { type: "binary", op: "^", left: base, right: exp };
    }
    return base;
  }
  function primary(): Node {
    const t = next();
    if (t.kind === "num") return { type: "num", value: t.value };
    if (t.kind === "str") return { type: "str", value: t.value };
    if (t.kind === "id") {
      if (t.value === "true") return { type: "bool", value: true };
      if (t.value === "false") return { type: "bool", value: false };
      if (isOp("(")) {
        next();
        const args: Node[] = [];
        if (!isOp(")")) {
          args.push(ternary());
          while (isOp(",")) {
            next();
            args.push(ternary());
          }
        }
        expect(")");
        return { type: "call", name: t.value.toLowerCase(), args, pos: t.pos };
      }
      return { type: "var", name: t.value, pos: t.pos };
    }
    if (t.kind === "op" && t.value === "(") {
      enter();
      const e = ternary();
      depth--;
      expect(")");
      return e;
    }
    throw new FormulaError(t.kind === "eof" ? "Fórmula incompleta" : "Expresión no válida", t.pos);
  }

  if (peek().kind === "eof") throw new FormulaError("La fórmula está vacía", 0);
  const ast = ternary();
  const rest = peek();
  if (rest.kind !== "eof") throw new FormulaError("Sobra texto al final de la fórmula", rest.pos);
  return ast;
}

const num = (v: Value): number => (typeof v === "number" ? v : typeof v === "boolean" ? (v ? 1 : 0) : Number.NaN);
const truthy = (v: Value): boolean => (typeof v === "string" ? v.length > 0 : typeof v === "number" ? v !== 0 : v);

const FUNCTIONS: Record<string, { arity: [number, number]; fn: (args: Value[]) => Value }> = {
  min: { arity: [1, 20], fn: (a) => Math.min(...a.map(num)) },
  max: { arity: [1, 20], fn: (a) => Math.max(...a.map(num)) },
  abs: { arity: [1, 1], fn: (a) => Math.abs(num(a[0]!)) },
  redondear: { arity: [1, 1], fn: (a) => Math.round(num(a[0]!)) },
  round: { arity: [1, 1], fn: (a) => Math.round(num(a[0]!)) },
  techo: { arity: [1, 1], fn: (a) => Math.ceil(num(a[0]!)) },
  ceil: { arity: [1, 1], fn: (a) => Math.ceil(num(a[0]!)) },
  suelo: { arity: [1, 1], fn: (a) => Math.floor(num(a[0]!)) },
  floor: { arity: [1, 1], fn: (a) => Math.floor(num(a[0]!)) },
};

export const FUNCTION_NAMES = [...Object.keys(FUNCTIONS), "si", "if"];

export function evaluateNode(node: Node, scope: Scope): Value {
  switch (node.type) {
    case "num":
    case "str":
    case "bool":
      return node.value;
    case "var": {
      if (!Object.prototype.hasOwnProperty.call(scope, node.name)) {
        throw new FormulaError(`Variable desconocida "${node.name}"`, node.pos);
      }
      return scope[node.name]!;
    }
    case "unary": {
      const v = evaluateNode(node.arg, scope);
      return node.op === "!" ? !truthy(v) : -num(v);
    }
    case "cond":
      return truthy(evaluateNode(node.test, scope)) ? evaluateNode(node.then, scope) : evaluateNode(node.else, scope);
    case "call": {
      if (node.name === "si" || node.name === "if") {
        if (node.args.length !== 3) throw new FormulaError("si() necesita 3 argumentos", node.pos);
        return truthy(evaluateNode(node.args[0]!, scope))
          ? evaluateNode(node.args[1]!, scope)
          : evaluateNode(node.args[2]!, scope);
      }
      const f = FUNCTIONS[node.name];
      if (!f) throw new FormulaError(`Función desconocida "${node.name}"`, node.pos);
      if (node.args.length < f.arity[0] || node.args.length > f.arity[1]) {
        throw new FormulaError(`Número de argumentos incorrecto en ${node.name}()`, node.pos);
      }
      return f.fn(node.args.map((a) => evaluateNode(a, scope)));
    }
    case "binary": {
      if (node.op === "&&") return truthy(evaluateNode(node.left, scope)) && truthy(evaluateNode(node.right, scope));
      if (node.op === "||") return truthy(evaluateNode(node.left, scope)) || truthy(evaluateNode(node.right, scope));
      const l = evaluateNode(node.left, scope);
      const r = evaluateNode(node.right, scope);
      switch (node.op) {
        case "==":
          return typeof l === "string" || typeof r === "string" ? String(l) === String(r) : num(l) === num(r);
        case "!=":
          return typeof l === "string" || typeof r === "string" ? String(l) !== String(r) : num(l) !== num(r);
        case "<":
          return num(l) < num(r);
        case "<=":
          return num(l) <= num(r);
        case ">":
          return num(l) > num(r);
        case ">=":
          return num(l) >= num(r);
        case "+":
          return num(l) + num(r);
        case "-":
          return num(l) - num(r);
        case "*":
          return num(l) * num(r);
        case "/": {
          const d = num(r);
          return d === 0 ? 0 : num(l) / d;
        }
        case "%": {
          const d = num(r);
          return d === 0 ? 0 : num(l) % d;
        }
        case "^":
          return num(l) ** num(r);
      }
      /* c8 ignore next */
      throw new FormulaError(`Operador desconocido ${node.op}`, 0);
    }
  }
}

/** Collects every variable name referenced in the AST. */
export function collectVariables(node: Node, out = new Set<string>()): Set<string> {
  switch (node.type) {
    case "var":
      out.add(node.name);
      break;
    case "unary":
      collectVariables(node.arg, out);
      break;
    case "binary":
      collectVariables(node.left, out);
      collectVariables(node.right, out);
      break;
    case "cond":
      collectVariables(node.test, out);
      collectVariables(node.then, out);
      collectVariables(node.else, out);
      break;
    case "call":
      node.args.forEach((a) => collectVariables(a, out));
      break;
  }
  return out;
}

const cache = new Map<string, Node>();
function compile(src: string): Node {
  let ast = cache.get(src);
  if (!ast) {
    ast = parse(src);
    if (cache.size > 2000) cache.clear();
    cache.set(src, ast);
  }
  return ast;
}

export function evaluate(src: string, scope: Scope): Value {
  return evaluateNode(compile(src), scope);
}

export function evaluateNumber(src: string, scope: Scope): number {
  const v = num(evaluate(src, scope));
  if (!Number.isFinite(v)) throw new FormulaError("La fórmula no devuelve un número", 0);
  return v;
}

export function evaluateBoolean(src: string | null | undefined, scope: Scope): boolean {
  if (!src || src.trim() === "") return true;
  return truthy(evaluate(src, scope));
}

export type ValidationResult = { ok: true; variables: string[] } | { ok: false; error: string; position: number };

/** Validates syntax and that all referenced variables are known. */
export function validateFormula(src: string, knownVariables: Iterable<string>): ValidationResult {
  try {
    const ast = parse(src);
    const known = new Set(knownVariables);
    const vars = [...collectVariables(ast)];
    const unknown = vars.find((v) => !known.has(v));
    if (unknown) return { ok: false, error: `Variable desconocida "${unknown}"`, position: src.indexOf(unknown) };
    validateCalls(ast);
    return { ok: true, variables: vars };
  } catch (e) {
    if (e instanceof FormulaError) return { ok: false, error: e.message, position: e.position };
    throw e;
  }
}

function validateCalls(node: Node): void {
  if (node.type === "call") {
    if (!FUNCTION_NAMES.includes(node.name)) throw new FormulaError(`Función desconocida "${node.name}"`, node.pos);
    node.args.forEach(validateCalls);
  } else if (node.type === "unary") validateCalls(node.arg);
  else if (node.type === "binary") {
    validateCalls(node.left);
    validateCalls(node.right);
  } else if (node.type === "cond") {
    validateCalls(node.test);
    validateCalls(node.then);
    validateCalls(node.else);
  }
}
