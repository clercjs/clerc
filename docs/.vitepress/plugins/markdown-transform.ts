import type { Plugin } from "vitepress";

// @keep-sorted
export const clercImports = [
  "buildHelpDocument",
  "clerc",
  "Clerc",
  "ClercError",
  "createLogger",
  "createMemoryTerminal",
  "createTerminal",
  "createTheme",
  "defaultHelpSections",
  "defaultThemeStyles",
  "formatDiagnostic",
  "isStandardSchema",
  "plugin",
  "Plugin",
  "prompts",
  "renderHelp",
  "renderHelpDocument",
  "Types",
];

export const MarkdownTransform = (): Plugin => ({
  name: "clerc-markdown-transform",
  enforce: "pre",
  transform(code, id) {
    if (!id.endsWith(".md")) {
      return;
    }

    return code.replace(
      /```(ts|typescript)([^\n]*)\n([\s\S]*?)```/g,
      (match, lang: string, rawAttrs: string, body: string) => {
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
