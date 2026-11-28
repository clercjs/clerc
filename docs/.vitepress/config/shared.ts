import UnoCSS from "unocss/vite";
import { defineConfig } from "vitepress";
import {
  groupIconMdPlugin,
  groupIconVitePlugin as GroupIconVitePlugin,
} from "vitepress-plugin-group-icons";
import Llms, { copyOrDownloadAsMarkdownButtons } from "vitepress-plugin-llms";

import pkg from "../../../packages/clerc/package.json" with { type: "json" };
import { PlaygroundVitePlugin } from "../playground/vite-plugin.ts";
import { createTwoslashTransformer } from "./twoslash.ts";

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
    codeTransformers: [createTwoslashTransformer()],
    languages: ["js", "jsx", "ts", "tsx", "sh", "bash", "json"],
  },
  vite: {
    plugins: [
      PlaygroundVitePlugin(),
      GroupIconVitePlugin(),
      UnoCSS(),
      Llms({
        ignoreFiles: ["index.md", "zh/**/*"],
        description: pkg.description,
      }) as any,
    ],
  },
});
