import { stripAnsi } from "./ansi.ts";

const ESC = String.fromCodePoint(27);
const CODES: Readonly<Record<string, readonly [number, number]>> = {
  bold: [1, 22],
  dim: [2, 22],
  underline: [4, 24],
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  magenta: [35, 39],
  cyan: [36, 39],
  gray: [90, 39],
  grey: [90, 39],
};

export function styleText(
  format: string | readonly string[],
  text: string,
): string {
  const list = Array.isArray(format) ? format : [format];
  let out = String(text);
  for (let i = list.length - 1; i >= 0; i--) {
    const pair = CODES[list[i]];
    if (pair) {
      out = `${ESC}[${pair[0]}m${out}${ESC}[${pair[1]}m`;
    }
  }

  return out;
}

function formatValue(
  val: unknown,
  colors: boolean,
  depth: number,
  indent = 0,
): string {
  if (val === null) {
    return colors ? styleText("bold", "null") : "null";
  }
  if (val === undefined) {
    return colors ? styleText("gray", "undefined") : "undefined";
  }
  if (typeof val === "string") {
    const quoted = `'${val}'`;

    return colors ? styleText("green", quoted) : quoted;
  }
  if (typeof val === "number" || typeof val === "boolean") {
    return colors ? styleText("yellow", String(val)) : String(val);
  }
  if (Array.isArray(val)) {
    if (val.length === 0) {
      return "[]";
    }
    if (depth <= 0) {
      return "[Array]";
    }

    return `[ ${val.map((v) => formatValue(v, colors, depth - 1, indent)).join(", ")} ]`;
  }
  if (typeof val === "object") {
    const entries = Object.entries(val);
    if (entries.length === 0) {
      return "{}";
    }
    if (depth <= 0) {
      return "[Object]";
    }
    const parts = entries.map(
      ([k, v]) => `${k}: ${formatValue(v, colors, depth - 1, indent + 2)}`,
    );
    const single = `{ ${parts.join(", ")} }`;
    if (stripAnsi(single).length <= 54) {
      return single;
    }
    const pad = " ".repeat(indent + 2);
    const closePad = " ".repeat(indent);

    return `{\n${parts.map((p) => pad + p).join(",\n")}\n${closePad}}`;
  }

  return String(val);
}

export const inspect = (
  val: unknown,
  options: { readonly colors?: boolean; readonly depth?: number } = {},
): string => formatValue(val, Boolean(options.colors), options.depth ?? 2, 0);
