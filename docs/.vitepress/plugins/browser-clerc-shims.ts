import path from "node:path";

import type { Plugin } from "vitepress";

const TTY_ID = "\0clerc-browser:tty";
const UTIL_ID = "\0clerc-browser:util";
const CLACK_ID = "\0clerc-browser:clack";
const READLINE_ID = "\0clerc-browser:readline";
const MODULE_ID = "\0clerc-browser:module";

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const clercEntry = path.resolve(repoRoot, "packages/clerc/src/index.ts");
const themeEntry = path.resolve(repoRoot, "packages/theme/src/index.ts");
const loggerEntry = path.resolve(repoRoot, "packages/logger/src/index.ts");
const completionsEntry = path.resolve(
  repoRoot,
  "packages/plugin-completions/src/index.ts",
);

function isClercPkgImporter(importer?: string): boolean {
  if (!importer) {
    return false;
  }
  const normalized = importer.replaceAll("\\", "/");

  return (
    normalized.includes("/packages/theme/") ||
    normalized.includes("/packages/logger/") ||
    normalized.includes("/packages/plugin-mcp/") ||
    normalized.includes("/packages/plugin-completions/")
  );
}

export const BrowserClercShims = (): Plugin => ({
  name: "clerc-browser-shims",
  enforce: "pre",
  resolveId(id, importer) {
    if (id === "@clerc/theme") {
      return themeEntry;
    }
    if (id === "@clerc/logger") {
      return loggerEntry;
    }
    if (id === "@clerc/plugin-completions") {
      return completionsEntry;
    }
    if (importer === MODULE_ID && id === "@clack/prompts") {
      return CLACK_ID;
    }
    if (isClercPkgImporter(importer)) {
      if (id === "node:module") {
        return MODULE_ID;
      }
      if (id === "node:tty") {
        return TTY_ID;
      }
      if (id === "node:util") {
        return UTIL_ID;
      }
      if (id === "@clack/prompts") {
        return CLACK_ID;
      }
      if (id === "node:readline") {
        return READLINE_ID;
      }
      if (id === "clerc") {
        return clercEntry;
      }
    }
  },
  load(id) {
    if (id === TTY_ID) {
      return String.raw`export class WriteStream {
  hasColors() {
    return true;
  }
}
`;
    }

    if (id === READLINE_ID) {
      return String.raw`export function createInterface() {
  throw new Error("stdio readline is not supported in browser preview");
}
`;
    }

    if (id === MODULE_ID) {
      return String.raw`import * as clack from "@clack/prompts";
export function createRequire() {
  return (specifier) => {
    if (specifier === "@clack/prompts") return clack;
    throw new Error("Dynamic require not supported in browser: " + specifier);
  };
}
`;
    }

    if (id === UTIL_ID) {
      return String.raw`const ESC = String.fromCodePoint(27);
const CODES = {
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

function stripAnsi(str) {
  let out = "";
  let i = 0;
  while (i < str.length) {
    const esc = str.indexOf(ESC + "[", i);
    if (esc === -1) {
      out += str.slice(i);
      break;
    }
    out += str.slice(i, esc);
    const end = str.indexOf("m", esc + 2);
    i = end === -1 ? str.length : end + 1;
  }
  return out;
}

export function styleText(format, text) {
  const list = Array.isArray(format) ? format : [format];
  let out = String(text);
  for (let i = list.length - 1; i >= 0; i--) {
    const pair = CODES[list[i]];
    if (pair) {
      out = ESC + "[" + pair[0] + "m" + out + ESC + "[" + pair[1] + "m";
    }
  }
  return out;
}

function formatValue(val, colors, depth, indent = 0) {
  if (val === null) return colors ? styleText("bold", "null") : "null";
  if (val === undefined) return colors ? styleText("gray", "undefined") : "undefined";
  if (typeof val === "string") {
    const quoted = "'" + val + "'";
    return colors ? styleText("green", quoted) : quoted;
  }
  if (typeof val === "number" || typeof val === "boolean") {
    return colors ? styleText("yellow", String(val)) : String(val);
  }
  if (Array.isArray(val)) {
    if (val.length === 0) return "[]";
    if (depth <= 0) return "[Array]";
    return "[ " + val.map((v) => formatValue(v, colors, depth - 1, indent)).join(", ") + " ]";
  }
  if (typeof val === "object") {
    const entries = Object.entries(val);
    if (entries.length === 0) return "{}";
    if (depth <= 0) return "[Object]";
    const parts = entries.map(
      ([k, v]) => k + ": " + formatValue(v, colors, depth - 1, indent + 2),
    );
    const single = "{ " + parts.join(", ") + " }";
    if (stripAnsi(single).length <= 54) {
      return single;
    }
    const pad = " ".repeat(indent + 2);
    const closePad = " ".repeat(indent);
    return "{\n" + parts.map((p) => pad + p).join(",\n") + "\n" + closePad + "}";
  }
  return String(val);
}

export function inspect(val, options = {}) {
  return formatValue(val, Boolean(options.colors), options.depth ?? 2, 0);
}
`;
    }

    if (id === CLACK_ID) {
      return String.raw`const ESC = String.fromCodePoint(27);
function stripAnsi(str) {
  let out = "";
  let i = 0;
  while (i < str.length) {
    const esc = str.indexOf(ESC + "[", i);
    if (esc === -1) {
      out += str.slice(i);
      break;
    }
    out += str.slice(i, esc);
    const end = str.indexOf("m", esc + 2);
    i = end === -1 ? str.length : end + 1;
  }
  return out;
}

export function box(message = "", title = "", options = {}) {
  const fmt = options.formatBorder ?? ((c) => c);
  const bodyLines = String(message).split("\n");
  const titleVis = title ? stripAnsi(title).length : 0;
  const maxBody = bodyLines.reduce((m, l) => Math.max(m, stripAnsi(l).length), 0);
  const inner = Math.max(maxBody + 4, titleVis + 4);
  const topFill = Math.max(1, inner - 1 - titleVis);
  const top = fmt("╭─") + (title ?? "") + fmt("─".repeat(topFill) + "╮");
  const rows = bodyLines.map((line) => {
    const pad = Math.max(0, inner - 2 - stripAnsi(line).length);
    return fmt("│") + "  " + line + " ".repeat(pad) + fmt("│");
  });
  const bottom = fmt("╰" + "─".repeat(inner) + "╯");
  options.output?.write([top, ...rows, bottom].join("\n") + "\n");
}

export function spinner() {
  return {
    start() {},
    message() {},
    stop() {},
    error() {},
    cancel() {},
    clear() {},
    isCancelled: false,
  };
}
`;
    }
  },
});
