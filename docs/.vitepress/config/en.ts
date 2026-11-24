import { join } from "node:path";

import type { DefaultTheme, LocaleSpecificConfig } from "vitepress";

import { getNavigation } from "../utils/navigation.ts";

const pluginNavigation = await getNavigation(
  join(import.meta.dirname, "..", "..", "official-plugins"),
  "/official-plugins",
);

const sidebar: DefaultTheme.Config["sidebar"] = [
  {
    text: "Guide",
    items: [
      { text: "Getting Started", link: "/guide/getting-started" },
      { text: "Commands", link: "/guide/commands" },
      { text: "Arguments", link: "/guide/arguments" },
      { text: "Flags", link: "/guide/flags" },
      { text: "Types", link: "/guide/types" },
      { text: "Rules", link: "/guide/rules" },
      { text: "Middleware", link: "/guide/middleware" },
      { text: "Plugins", link: "/guide/plugins" },
    ],
  },
  {
    text: "Terminal Output",
    items: [
      { text: "Help", link: "/guide/help" },
      { text: "Error Handling", link: "/guide/errors" },
      { text: "Logger", link: "/guide/logger" },
      { text: "Spinners and Prompts", link: "/guide/prompts" },
    ],
  },
  {
    text: "Advanced",
    items: [{ text: "Testing", link: "/guide/testing" }],
  },
  {
    text: "Official Plugins",
    items: pluginNavigation,
  },
];

export const enConfig: LocaleSpecificConfig<DefaultTheme.Config> = {
  lang: "en-US",
  description:
    "Typed CLI framework for Node.js with built-in help, diagnostics, logger, completions, and MCP.",
  themeConfig: {
    siteTitle: "Clerc",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Official Plugins", items: pluginNavigation },
      { text: "Members", link: "/members" },
    ],
    sidebar,
    editLink: {
      text: "Edit this page on GitHub",
      pattern: "https://github.com/clercjs/clerc/tree/main/docs/:path",
    },
    outline: {
      label: "On this page",
    },
    docFooter: {
      prev: "Previous",
      next: "Next",
    },
    footer: {
      message: "Released under the MIT License",
      copyright: "Copyright © 2023-present Clerc Developers",
    },
  },
};
