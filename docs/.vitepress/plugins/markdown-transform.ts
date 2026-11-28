import type { Plugin } from "vitepress";

// @keep-sorted
export const clercImports = [
  "atLeastOne",
  "buildHelpDocument",
  "ClercError",
  "cli",
  "Cli",
  "command",
  "Command",
  "Complete",
  "ConstraintError",
  "createLogger",
  "createMemoryTerminal",
  "createTerminal",
  "createTheme",
  "defaultHelpSections",
  "defaultThemeStyles",
  "exclusive",
  "formatDiagnostic",
  "group",
  "isStandardSchema",
  "middleware",
  "Middleware",
  "oneOf",
  "renderHelp",
  "renderHelpDocument",
  "together",
  "Types",
  "use",
];

const PLAYGROUND_NAMED_IMPORT_RE =
  /^import\s+\{([\s\S]*?)\}\s+from\s+(["'][^"']+\.playground\.ts["']);?/gm;
const PLAYGROUND_DEFAULT_IMPORT_RE =
  /^import\s+([A-Za-z_$][\w$]*)\s+from\s+(["'][^"']+\.playground\.ts["']);?/gm;

function rewritePlaygroundImports(code: string): string {
  let loaderIdx = 0;

  let transformed = code.replace(
    PLAYGROUND_NAMED_IMPORT_RE,
    (_match, specifiers: string, specifierPath: string) => {
      const loaderName = `__loadPlayground${loaderIdx++}`;
      const lines = [`const ${loaderName} = () => import(${specifierPath});`];

      for (const raw of specifiers.split(",")) {
        const cleaned = raw.trim();
        if (!cleaned) {
          continue;
        }
        const parts = cleaned.split(/\s+as\s+/);
        const imported = parts[0].trim();
        const local = (parts[1] ?? parts[0]).trim();
        lines.push(
          `const ${local} = () => ${loaderName}().then((m) => m.${imported});`,
        );
      }

      return lines.join("\n");
    },
  );

  transformed = transformed.replace(
    PLAYGROUND_DEFAULT_IMPORT_RE,
    (_match, local: string, specifierPath: string) =>
      `const ${local} = () => import(${specifierPath}).then((m) => m.default);`,
  );

  return transformed;
}

export const MarkdownTransform = (): Plugin => ({
  name: "clerc-markdown-transform",
  enforce: "pre",
  transform(code, id) {
    if (!id.endsWith(".md")) {
      return;
    }

    const withLazyPlaygrounds = rewritePlaygroundImports(code);

    return withLazyPlaygrounds.replace(
      /```(ts|typescript)([^\n]*)\n([\s\S]*?)```/g,
      (_match, lang: string, rawAttrs: string, body: string) => {
        if (rawAttrs.includes("no-twoslash")) {
          const cleanAttrs = rawAttrs.replace(/\bno-twoslash\b/, "").trim();

          return `\`\`\`${lang}${cleanAttrs ? ` ${cleanAttrs}` : ""}\n${body}\`\`\``;
        }

        const attrs = rawAttrs.includes("twoslash")
          ? rawAttrs
          : `${rawAttrs} twoslash`;
        const hasExplicitImport =
          /from\s+["'](?:clerc|@clerc\/)[^"']*["']/.test(body);
        const prefix = hasExplicitImport ? "" : "// @include: imports\n";

        return `\`\`\`${lang}${attrs}\n${prefix}${body}\`\`\``;
      },
    );
  },
});
