import path from "node:path";

import {
  rendererFloatingVue,
  transformerTwoslash,
} from "@shikijs/vitepress-twoslash";
import UnoCSS from "unocss/vite";
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

const baseTwoslashRenderer = rendererFloatingVue({
  queryRendering: "line",
});

const twoslashRenderer = {
  ...baseTwoslashRenderer,
  // Keep the queried token as a plain inline span (suppressing duplicate hover
  // poppers and preserving its text child so lineQuery aligns the arrow).
  nodeQuery: (_query: unknown, node: any) => node,
};

export const sharedConfig = defineConfig({
  title: "Clerc",
  lastUpdated: true,
  head: [["link", { rel: "icon", href: "/logo.webp", type: "image/webp" }]],
  themeConfig: {
    logo: "/logo.webp",
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
        renderer: twoslashRenderer,
        twoslashOptions: {
          compilerOptions: {
            target: 99,
            module: 99,
            moduleResolution: 100,
            strict: true,
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
