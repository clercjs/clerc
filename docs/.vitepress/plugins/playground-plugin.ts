import type { Plugin } from "vitepress";

const PLAYGROUND_RUNTIME_RE = /playground-runtime(?:\.[jt]s)?$/;
const PLUGIN_MCP_RE = /plugin-mcp\/src\/protocol(?:\.[jt]s)?$/;
const SKIPPED_IMPORTS = new Set(["LiveRunContext", "PlaygroundScenario"]);

interface ImportSymbol {
  readonly name: string;
  readonly source: string;
  readonly isType: boolean;
}

interface HelperDecl {
  readonly name: string;
  readonly code: string;
}

function skipStringOrComment(code: string, index: number): number {
  const ch = code[index];
  const next = code[index + 1];

  if (ch === "/" && next === "/") {
    let i = index + 2;
    while (i < code.length && code[i] !== "\n") {
      i++;
    }

    return i;
  }

  if (ch === "/" && next === "*") {
    let i = index + 2;
    while (i < code.length - 1 && (code[i] !== "*" || code[i + 1] !== "/")) {
      i++;
    }

    return Math.min(code.length, i + 2);
  }

  if (ch === "'" || ch === '"') {
    let i = index + 1;
    while (i < code.length) {
      if (code[i] === "\\") {
        i += 2;

        continue;
      }
      if (code[i] === ch) {
        return i + 1;
      }
      i++;
    }

    return code.length;
  }

  if (ch === "`") {
    let i = index + 1;
    while (i < code.length) {
      if (code[i] === "\\") {
        i += 2;

        continue;
      }
      if (code[i] === "`") {
        return i + 1;
      }
      if (code[i] === "$" && code[i + 1] === "{") {
        i = findMatchingDelimiter(code, i + 1, "{", "}");

        continue;
      }
      i++;
    }

    return code.length;
  }

  return index;
}

function findMatchingDelimiter(
  code: string,
  openIdx: number,
  open: string,
  close: string,
): number {
  let depth = 0;
  let i = openIdx;

  while (i < code.length) {
    const skipped = skipStringOrComment(code, i);
    if (skipped > i) {
      i = skipped;

      continue;
    }

    const ch = code[i];
    if (ch === open) {
      depth++;
    } else if (ch === close) {
      depth--;
      if (depth === 0) {
        return i + 1;
      }
    }
    i++;
  }

  return code.length;
}

function findExpressionEnd(code: string, start: number): number {
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  let i = start;

  while (i < code.length) {
    const skipped = skipStringOrComment(code, i);
    if (skipped > i) {
      i = skipped;

      continue;
    }

    const ch = code[i];
    if (ch === "(") {
      paren++;
    } else if (ch === ")") {
      paren--;
    } else if (ch === "{") {
      brace++;
    } else if (ch === "}") {
      if (paren === 0 && brace === 0 && bracket === 0) {
        return i;
      }
      brace--;
    } else if (ch === "[") {
      bracket++;
    } else if (ch === "]") {
      bracket--;
    } else if (ch === "," && paren === 0 && brace === 0 && bracket === 0) {
      return i;
    }
    i++;
  }

  return code.length;
}

function findStatementEnd(code: string, start: number): number {
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  let i = start;

  while (i < code.length) {
    const skipped = skipStringOrComment(code, i);
    if (skipped > i) {
      i = skipped;

      continue;
    }

    const ch = code[i];
    if (ch === "(") {
      paren++;
    } else if (ch === ")") {
      paren--;
    } else if (ch === "{") {
      brace++;
    } else if (ch === "}") {
      brace--;
    } else if (ch === "[") {
      bracket++;
    } else if (ch === "]") {
      bracket--;
    } else if (ch === ";" && paren === 0 && brace === 0 && bracket === 0) {
      return i + 1;
    }
    i++;
  }

  return code.length;
}

function dedent(text: string): string {
  const lines = text.replace(/^\n+|\n+$/g, "").split("\n");
  let minIndent = Number.POSITIVE_INFINITY;
  for (const line of lines) {
    if (line.trim().length === 0) {
      continue;
    }
    const match = /^ */.exec(line);
    if (match && match[0].length < minIndent) {
      minIndent = match[0].length;
    }
  }
  if (!Number.isFinite(minIndent) || minIndent === 0) {
    return lines.join("\n");
  }

  return lines.map((line) => line.slice(minIndent)).join("\n");
}

function mapImportSource(rawSource: string, symbol: string): string {
  if (PLAYGROUND_RUNTIME_RE.test(rawSource)) {
    if (symbol === "completions" || symbol === "ShellCompDirective") {
      return "@clerc/plugin-completions";
    }

    return "clerc";
  }
  if (PLUGIN_MCP_RE.test(rawSource)) {
    return "@clerc/plugin-mcp";
  }

  return rawSource;
}

function parseImports(code: string): ImportSymbol[] {
  const imports: ImportSymbol[] = [];
  const re = /^import\s+(type\s+)?\{([\s\S]*?)\}\s+from\s+["']([^"']+)["'];?/gm;

  for (const match of code.matchAll(re)) {
    const isType = Boolean(match[1]);
    const specifiers = match[2];
    const rawSource = match[3];
    for (const part of specifiers.split(",")) {
      const cleaned = part.trim();
      if (!cleaned) {
        continue;
      }
      const isInlineType = cleaned.startsWith("type ");
      const name = cleaned.replace(/^type\s+/, "").trim();
      if (!name || SKIPPED_IMPORTS.has(name)) {
        continue;
      }
      imports.push({
        name,
        source: mapImportSource(rawSource, name),
        isType: isType || isInlineType,
      });
    }
  }

  return imports;
}

function parseTopLevelHelpers(code: string): HelperDecl[] {
  const helpers: HelperDecl[] = [];
  let i = 0;

  while (i < code.length) {
    while (i < code.length && /\s/.test(code[i])) {
      i++;
    }
    const skipped = skipStringOrComment(code, i);
    if (skipped > i) {
      i = skipped;

      continue;
    }

    const slice = code.slice(i);
    if (slice.startsWith("import ") || slice.startsWith("export ")) {
      i = findStatementEnd(code, i);

      continue;
    }

    const constMatch = /^(?:const|function)\s+([A-Za-z_$][\w$]*)/.exec(slice);
    if (constMatch) {
      const end = findStatementEnd(code, i);
      const stmt = code.slice(i, end).trim();
      const name = constMatch[1];
      if (!/:\s*PlaygroundScenario\b/.test(stmt)) {
        helpers.push({ name, code: stmt });
      }
      i = end;

      continue;
    }

    const assignMatch = /^([A-Z_$][\w$]*)\.[A-Z_$][\w$]*\s*=/i.exec(slice);
    if (assignMatch) {
      const end = findStatementEnd(code, i);
      const stmt = code.slice(i, end).trim();
      const target = helpers.find((h) => h.name === assignMatch[1]);
      if (target) {
        const idx = helpers.indexOf(target);
        helpers[idx] = { name: target.name, code: `${target.code}\n${stmt}` };
      }
      i = end;

      continue;
    }

    i = findStatementEnd(code, i);
  }

  return helpers;
}

function buildImportLines(
  allImports: readonly ImportSymbol[],
  body: string,
): string[] {
  const bySource = new Map<string, { value: string[]; type: string[] }>();

  for (const sym of allImports) {
    const ident = sym.name.split(/\s+as\s+/).pop() ?? sym.name;
    const re = new RegExp(`\\b${ident}\\b`);
    if (!re.test(body)) {
      continue;
    }
    let entry = bySource.get(sym.source);
    if (!entry) {
      entry = { value: [], type: [] };
      bySource.set(sym.source, entry);
    }
    if (sym.isType) {
      if (!entry.type.includes(sym.name)) {
        entry.type.push(sym.name);
      }
    } else if (!entry.value.includes(sym.name)) {
      entry.value.push(sym.name);
    }
  }

  const lines: string[] = [];
  for (const [source, { type, value }] of bySource) {
    if (type.length > 0) {
      lines.push(`import type { ${type.join(", ")} } from "${source}";`);
    }
    if (value.length > 0) {
      lines.push(`import { ${value.join(", ")} } from "${source}";`);
    }
  }

  return lines;
}

function dedentTail(lines: readonly string[]): string[] {
  if (lines.length <= 1) {
    return [...lines];
  }
  let minIndent = Number.POSITIVE_INFINITY;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim().length === 0) {
      continue;
    }
    const match = /^ */.exec(lines[i]);
    if (match && match[0].length < minIndent) {
      minIndent = match[0].length;
    }
  }
  if (!Number.isFinite(minIndent) || minIndent === 0) {
    return [...lines];
  }

  return [lines[0], ...lines.slice(1).map((line) => line.slice(minIndent))];
}

function formatCreateCliBody(rawBody: string): string {
  const trimmed = rawBody.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const inner = dedent(trimmed.slice(1, -1));
    const returnIdx = inner.lastIndexOf("\nreturn ");
    if (returnIdx !== -1) {
      return `${inner.slice(0, returnIdx)}\nconst app = ${inner.slice(returnIdx + "\nreturn ".length)}`;
    }
    if (inner.startsWith("return ")) {
      return `const app = ${inner.slice("return ".length)}`;
    }

    return inner;
  }

  const dedented = dedentTail(trimmed.split("\n")).join("\n");
  const needsSemi = !dedented.endsWith(";");

  return `const app = ${dedented}${needsSemi ? ";" : ""}`;
}

function hasTopLevelProperty(objCode: string, prop: string): boolean {
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  let i = 1;

  while (i < objCode.length - 1) {
    const skipped = skipStringOrComment(objCode, i);
    if (skipped > i) {
      i = skipped;

      continue;
    }

    const ch = objCode[i];
    if (ch === "(") {
      paren++;
    } else if (ch === ")") {
      paren--;
    } else if (ch === "{") {
      brace++;
    } else if (ch === "}") {
      brace--;
    } else if (ch === "[") {
      bracket++;
    } else if (ch === "]") {
      bracket--;
    } else if (paren === 0 && brace === 0 && bracket === 0) {
      const match = new RegExp(`^${prop}\\s*:`).exec(objCode.slice(i));
      if (match) {
        const prev = objCode[i - 1];
        if (!prev || !/[\w$]/.test(prev)) {
          return true;
        }
      }
    }
    i++;
  }

  return false;
}

function findTopLevelPropertyValueRange(
  objCode: string,
  prop: string,
): { readonly start: number; readonly end: number } | null {
  let paren = 0;
  let brace = 0;
  let bracket = 0;
  let i = 1;

  while (i < objCode.length - 1) {
    const skipped = skipStringOrComment(objCode, i);
    if (skipped > i) {
      i = skipped;

      continue;
    }

    const ch = objCode[i];
    if (ch === "(") {
      paren++;
    } else if (ch === ")") {
      paren--;
    } else if (ch === "{") {
      brace++;
    } else if (ch === "}") {
      brace--;
    } else if (ch === "[") {
      bracket++;
    } else if (ch === "]") {
      bracket--;
    } else if (paren === 0 && brace === 0 && bracket === 0) {
      const match = new RegExp(`^${prop}\\s*:\\s*`).exec(objCode.slice(i));
      if (match) {
        const prev = objCode[i - 1];
        if (!prev || !/[\w$]/.test(prev)) {
          const start = i + match[0].length;
          const end = findExpressionEnd(objCode, start);

          return { start, end };
        }
      }
    }
    i++;
  }

  return null;
}

export function injectPlaygroundSources(code: string): string {
  const allImports = parseImports(code);
  const helpers = parseTopLevelHelpers(code);
  const scenarioRe = /:\s*PlaygroundScenario\s*=\s*\{/g;
  const replacements: { readonly at: number; readonly text: string }[] = [];

  for (const match of code.matchAll(scenarioRe)) {
    const openBraceIdx = (match.index ?? 0) + match[0].length - 1;
    const closeBraceIdx = findMatchingDelimiter(code, openBraceIdx, "{", "}");
    const objCode = code.slice(openBraceIdx, closeBraceIdx);

    if (hasTopLevelProperty(objCode, "source")) {
      continue;
    }

    const createCliRange = findTopLevelPropertyValueRange(objCode, "createCli");
    if (!createCliRange) {
      continue;
    }

    const fnExpr = objCode
      .slice(createCliRange.start, createCliRange.end)
      .trim();
    const arrowMatch = /^\([^)]*\)\s*=>/.exec(fnExpr);
    if (!arrowMatch) {
      continue;
    }

    const formattedCli = formatCreateCliBody(
      fnExpr.slice(arrowMatch[0].length),
    );
    const usedHelpers = helpers.filter((helper) =>
      new RegExp(`\\b${helper.name}\\b`).test(formattedCli),
    );
    const bodyWithHelpers = [
      ...usedHelpers.map((h) => h.code),
      formattedCli,
    ].join("\n\n");
    const importLines = buildImportLines(allImports, bodyWithHelpers);

    const envRange = findTopLevelPropertyValueRange(objCode, "env");
    const envComment = envRange
      ? `// env: ${objCode.slice(envRange.start, envRange.end).trim()}`
      : null;

    const sections: string[] = [];
    if (importLines.length > 0) {
      sections.push(importLines.join("\n"));
    }
    if (envComment) {
      sections.push(envComment);
    }
    sections.push(bodyWithHelpers);

    const source = sections.join("\n\n");
    replacements.push({
      at: openBraceIdx + 1,
      text: `\n  source: ${JSON.stringify(source)},`,
    });
  }

  if (replacements.length === 0) {
    return code;
  }

  let out = code;
  for (let idx = replacements.length - 1; idx >= 0; idx--) {
    const { at, text } = replacements[idx];
    out = out.slice(0, at) + text + out.slice(at);
  }

  return out;
}

export const PlaygroundPlugin = (): Plugin => ({
  name: "clerc-playground-source",
  enforce: "pre",
  transform(code, id) {
    const cleanId = id.split("?", 1)[0];
    if (!cleanId.endsWith(".playground.ts")) {
      return;
    }

    return injectPlaygroundSources(code);
  },
});
