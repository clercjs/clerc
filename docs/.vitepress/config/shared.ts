import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { transformerTwoslash } from "@shikijs/vitepress-twoslash";
import UnoCSS from "unocss/vite";
import type { DefaultTheme } from "vitepress";
import { defineConfig } from "vitepress";
import {
  groupIconMdPlugin,
  groupIconVitePlugin as GroupIconVitePlugin,
} from "vitepress-plugin-group-icons";
import Llms, { copyOrDownloadAsMarkdownButtons } from "vitepress-plugin-llms";

import pkg from "../../../packages/clerc/package.json" with { type: "json" };
import tsconfigBase from "../../../tsconfig.base.json" with { type: "json" };
import { BrowserClercShims } from "../plugins/browser-clerc-shims.ts";
import {
  MarkdownTransform,
  clercImports,
} from "../plugins/markdown-transform.ts";

const flattenItems = (
  items: DefaultTheme.SidebarItem[],
): DefaultTheme.SidebarItem[] =>
  items
    .flatMap((item) => {
      if (item.items && !item.link) {
        return flattenItems(item.items);
      }

      if (item.items) {
        return {
          ...item,
          items: flattenItems(item.items),
        };
      }

      return item;
    })
    .toSorted((a, b) => a.text!.localeCompare(b.text!));

export function getTypedocSidebar(pkgName: string) {
  const filepath = path.resolve(
    import.meta.dirname,
    `../../reference/api/${pkgName}/typedoc-sidebar.json`,
  );
  if (!existsSync(filepath)) {
    return [];
  }

  try {
    const items = JSON.parse(
      readFileSync(filepath, "utf-8"),
    ) as DefaultTheme.SidebarItem[];

    return flattenItems(items);
  } catch (error) {
    console.error(`Failed to load typedoc sidebar for ${pkgName}:`, error);

    return [];
  }
}

export const sharedConfig = defineConfig({
  title: "Clerc",
  lastUpdated: true,
  head: [["link", { rel: "icon", href: "/logo.webp", type: "image/webp" }]],
  themeConfig: {
    logo: {
      light: "/black.webp",
      dark: "/white.webp",
    },
    outline: [2, 3],
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/clercjs/clerc",
      },
    ],
    search: {
      provider: "local",
    },
  },
  markdown: {
    config(md) {
      md.use(groupIconMdPlugin);
      md.use(copyOrDownloadAsMarkdownButtons);
    },
    codeTransformers: [
      transformerTwoslash({
        twoslashOptions: {
          compilerOptions: {
            target: 99,
            module: 99,
            moduleResolution: 100,
            strict: true,
            types: ["node", "vite/client"],
            paths: Object.fromEntries(
              Object.entries(tsconfigBase.compilerOptions.paths).map(
                ([key, paths]) => [key, paths.map((p) => path.join("..", p))],
              ),
            ),
          },
          handbookOptions: {
            noErrors: true,
          },
        },
        includesMap: new Map([
          [
            "imports",
            `// ---cut-start---\nimport { ${clercImports.join(", ")} } from "clerc";\n// ---cut-end---`,
          ],
        ]),
      }),
    ],
    languages: ["js", "jsx", "ts", "tsx", "sh", "bash", "json"],
  },
  vite: {
    plugins: [
      BrowserClercShims(),
      GroupIconVitePlugin(),
      UnoCSS(),
      MarkdownTransform(),
      Llms({
        ignoreFiles: ["index.md", "zh/**/*"],
        description: pkg.description,
      }) as any,
    ],
  },
});
