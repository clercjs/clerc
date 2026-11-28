import { createRequire } from "node:module";
import path from "node:path";

import type { ESTree } from "vite";
import { parseSync } from "vite";
import type { Plugin } from "vitepress";

import tsconfigBase from "../../../tsconfig.base.json" with { type: "json" };

const SKIPPED_IMPORTS = new Set(["LiveRunContext", "PlaygroundScenario"]);

const repoRoot = path.resolve(import.meta.dirname, "../../..");
const shimsDir = path.resolve(import.meta.dirname, "shims");
const utilShim = path.resolve(shimsDir, "util.ts");
const clackShim = path.resolve(shimsDir, "clack.ts");
const nodeStubsShim = path.resolve(shimsDir, "node-stubs.ts");

const WORKSPACE_ENTRIES: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(tsconfigBase.compilerOptions.paths)
    .filter(([key]) => !key.includes("*"))
    .map(([key, targets]) => [key, path.resolve(repoRoot, targets[0])]),
);

const BROWSER_SHIMS: Readonly<Record<string, string>> = {
  "@clack/prompts": clackShim,
  "node:fs/promises": nodeStubsShim,
  "node:module": nodeStubsShim,
  "node:os": nodeStubsShim,
  "node:path": nodeStubsShim,
  "node:readline": nodeStubsShim,
  "node:tty": nodeStubsShim,
  "node:util": utilShim,
};

interface ImportSymbol {
  readonly name: string;
  readonly local: string;
  readonly source: string;
  readonly isType: boolean;
}

interface HelperDecl {
  readonly name: string;
  code: string;
}

interface ShikiHighlighter {
  readonly codeToHtml: (
    code: string,
    options: {
      readonly lang: string;
      readonly themes: { readonly light: string; readonly dark: string };
      readonly defaultColor: false;
    },
  ) => string;
}

let highlighterPromise: Promise<ShikiHighlighter> | null = null;

function getHighlighter(): Promise<ShikiHighlighter> {
  if (!highlighterPromise) {
    const req = createRequire(import.meta.url);
    const vpReq = createRequire(req.resolve("vitepress/package.json"));
    const shikiPath = vpReq.resolve("shiki");
    highlighterPromise = (
      import(shikiPath) as Promise<{
        readonly createHighlighter: (opts: {
          readonly themes: readonly string[];
          readonly langs: readonly string[];
        }) => Promise<ShikiHighlighter>;
      }>
    ).then((shiki) =>
      shiki.createHighlighter({
        themes: ["github-light", "github-dark"],
        langs: ["ts"],
      }),
    );
  }

  return highlighterPromise;
}

function highlightToInnerHtml(
  highlighter: ShikiHighlighter,
  source: string,
): string {
  const html = highlighter.codeToHtml(source, {
    lang: "ts",
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  });
  const match = /<code[^>]*>([\s\S]*?)<\/code>/.exec(html);

  return match ? match[1] : html;
}

function isWorkspacePackageImporter(importer?: string): boolean {
  if (!importer) {
    return false;
  }
  const normalized = importer.replaceAll("\\", "/");

  return (
    normalized.includes("/packages/clerc/") ||
    normalized.includes("/packages/theme/") ||
    normalized.includes("/packages/logger/") ||
    normalized.includes("/packages/plugin-mcp/") ||
    normalized.includes("/packages/plugin-completions/")
  );
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

function isPlaygroundScenarioDeclarator(
  decl: ESTree.VariableDeclarator,
): decl is ESTree.VariableDeclarator & {
  readonly init: ESTree.ObjectExpression;
} {
  if (decl.id.type !== "Identifier" || decl.init?.type !== "ObjectExpression") {
    return false;
  }
  const annotation = decl.id.typeAnnotation?.typeAnnotation;

  return (
    annotation?.type === "TSTypeReference" &&
    annotation.typeName.type === "Identifier" &&
    annotation.typeName.name === "PlaygroundScenario"
  );
}

function getObjectProperty(
  obj: ESTree.ObjectExpression,
  name: string,
): ESTree.ObjectProperty | undefined {
  for (const prop of obj.properties) {
    if (
      prop.type === "Property" &&
      !prop.computed &&
      prop.key.type === "Identifier" &&
      prop.key.name === name
    ) {
      return prop;
    }
  }

  return undefined;
}

function formatCreateCliBody(
  code: string,
  fn: ESTree.ArrowFunctionExpression | ESTree.Function,
): string {
  const { body } = fn;
  if (!body) {
    return "";
  }

  if (body.type === "BlockStatement") {
    const last = body.body.at(-1);
    const inner =
      last?.type === "ReturnStatement" && last.argument
        ? `${code.slice(body.start + 1, last.start)}const app = ${code.slice(last.argument.start, body.end - 1)}`
        : code.slice(body.start + 1, body.end - 1);

    return dedent(inner);
  }

  const dedented = dedentTail(
    code.slice(body.start, body.end).trim().split("\n"),
  ).join("\n");

  return `const app = ${dedented}${dedented.endsWith(";") ? "" : ";"}`;
}

function buildImportLines(
  allImports: readonly ImportSymbol[],
  body: string,
): string[] {
  const bySource = new Map<string, { value: string[]; type: string[] }>();

  for (const sym of allImports) {
    if (!new RegExp(`\\b${sym.local}\\b`).test(body)) {
      continue;
    }
    let entry = bySource.get(sym.source);
    if (!entry) {
      entry = { value: [], type: [] };
      bySource.set(sym.source, entry);
    }
    const bucket = sym.isType ? entry.type : entry.value;
    if (!bucket.includes(sym.name)) {
      bucket.push(sym.name);
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

export async function injectPlaygroundSources(
  code: string,
  filename = "playground.ts",
): Promise<string> {
  const { program } = parseSync(filename, code);
  const allImports: ImportSymbol[] = [];
  const helpers: HelperDecl[] = [];
  const scenarios: ESTree.ObjectExpression[] = [];

  for (const stmt of program.body) {
    if (stmt.type === "ImportDeclaration") {
      const source = stmt.source.value;
      for (const spec of stmt.specifiers) {
        if (spec.type !== "ImportSpecifier") {
          continue;
        }
        const imported =
          spec.imported.type === "Identifier"
            ? spec.imported.name
            : spec.imported.value;
        const local = spec.local.name;
        const name = imported === local ? local : `${imported} as ${local}`;
        if (SKIPPED_IMPORTS.has(name)) {
          continue;
        }
        allImports.push({
          name,
          local,
          source,
          isType: stmt.importKind === "type" || spec.importKind === "type",
        });
      }

      continue;
    }

    const exported = stmt.type === "ExportNamedDeclaration";
    const decl = exported ? stmt.declaration : stmt;

    if (decl?.type === "VariableDeclaration") {
      for (const item of decl.declarations) {
        if (isPlaygroundScenarioDeclarator(item)) {
          scenarios.push(item.init);
        } else if (!exported && item.id.type === "Identifier") {
          helpers.push({
            name: item.id.name,
            code: code.slice(stmt.start, stmt.end).trim(),
          });
        }
      }

      continue;
    }

    if (!exported && decl?.type === "FunctionDeclaration" && decl.id) {
      helpers.push({
        name: decl.id.name,
        code: code.slice(stmt.start, stmt.end).trim(),
      });

      continue;
    }

    if (
      stmt.type === "ExpressionStatement" &&
      stmt.expression.type === "AssignmentExpression" &&
      stmt.expression.left.type === "MemberExpression" &&
      stmt.expression.left.object.type === "Identifier"
    ) {
      const targetName = stmt.expression.left.object.name;
      const target = helpers.find((h) => h.name === targetName);
      if (target) {
        target.code = `${target.code}\n${code.slice(stmt.start, stmt.end).trim()}`;
      }
    }
  }

  const replacements: { readonly at: number; readonly text: string }[] = [];
  const highlighter = scenarios.length > 0 ? await getHighlighter() : null;

  for (const obj of scenarios) {
    if (getObjectProperty(obj, "source")) {
      continue;
    }
    const createCliProp = getObjectProperty(obj, "createCli");
    if (
      !createCliProp ||
      (createCliProp.value.type !== "ArrowFunctionExpression" &&
        createCliProp.value.type !== "FunctionExpression")
    ) {
      continue;
    }

    const formattedCli = formatCreateCliBody(code, createCliProp.value);
    const usedHelpers = helpers.filter((helper) =>
      new RegExp(`\\b${helper.name}\\b`).test(formattedCli),
    );
    const bodyWithHelpers = [
      ...usedHelpers.map((h) => h.code),
      formattedCli,
    ].join("\n\n");
    const importLines = buildImportLines(allImports, bodyWithHelpers);

    const envProp = getObjectProperty(obj, "env");
    const envComment = envProp
      ? `// env: ${code.slice(envProp.value.start, envProp.value.end).trim()}`
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
    const sourceHtml = highlighter
      ? highlightToInnerHtml(highlighter, source)
      : undefined;

    replacements.push({
      at: obj.start + 1,
      text: [
        `\n  source: ${JSON.stringify(source)},`,
        ...(sourceHtml
          ? [`\n  sourceHtml: ${JSON.stringify(sourceHtml)},`]
          : []),
      ].join(""),
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

export const PlaygroundVitePlugin = (): Plugin => ({
  name: "clerc-playground",
  enforce: "pre",
  resolveId(id, importer) {
    if (id in WORKSPACE_ENTRIES) {
      return WORKSPACE_ENTRIES[id];
    }
    if (isWorkspacePackageImporter(importer) && id in BROWSER_SHIMS) {
      return BROWSER_SHIMS[id];
    }
  },
  transform(code, id) {
    const cleanId = id.split("?", 1)[0];
    if (!cleanId.endsWith(".playground.ts")) {
      return;
    }

    return injectPlaygroundSources(code, cleanId);
  },
});
