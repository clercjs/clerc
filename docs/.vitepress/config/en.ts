import { join } from "node:path";

import type { DefaultTheme, LocaleSpecificConfig } from "vitepress";

import { PACKAGES } from "../scripts/generate-reference.ts";
import { getNavigation } from "../utils/navigation.ts";
import { getTypedocSidebar } from "./shared.ts";

const pluginNavigation = await getNavigation(
  join(import.meta.dirname, "..", "..", "official-plugins"),
  "/official-plugins",
);

const guideSidebar: DefaultTheme.Config["sidebar"] = [
  {
    text: "Guide",
    items: [
      { text: "Getting Started", link: "/guide/getting-started" },
      { text: "Commands & Routing", link: "/guide/commands" },
      { text: "Arguments", link: "/guide/arguments" },
      { text: "Flags", link: "/guide/flags" },
      { text: "Types & Schemas", link: "/guide/types" },
      { text: "Middleware & State", link: "/guide/middleware" },
      { text: "Plugins", link: "/guide/plugins" },
      { text: "Help & Diagnostics", link: "/guide/help-and-diagnostics" },
      { text: "Logger & Terminal UI", link: "/guide/logger" },
      { text: "Testing & Programmatic Use", link: "/guide/testing" },
    ],
  },
  {
    text: "Official Plugins",
    items: pluginNavigation,
  },
  {
    text: "API Reference",
    link: "/reference/api/",
    items: Object.entries(PACKAGES).map(([pkg, name]) => ({
      text: name,
      link: `/reference/api/${pkg}/`,
    })),
  },
];

const sidebar: DefaultTheme.Config["sidebar"] = {
  ...Object.fromEntries(
    Object.keys(PACKAGES).map((pkg) => [
      `/reference/api/${pkg}/`,
      [
        {
          text: "Back to Guide",
          link: "/guide/getting-started",
        },
        {
          text: "API Reference",
          link: `/api/${pkg}/`,
          items: getTypedocSidebar(pkg),
          base: "/reference",
        },
      ],
    ]),
  ),
  "/": guideSidebar,
};

export const enConfig: LocaleSpecificConfig<DefaultTheme.Config> = {
  lang: "en-US",
  description:
    "Strongly-typed CLI framework for Node.js 24+ with built-in help, diagnostics, logger, completions, and MCP.",
  themeConfig: {
    siteTitle: "Clerc",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Official Plugins", items: pluginNavigation },
      {
        text: "API Reference",
        items: [
          { text: "Overview", link: "/reference/api/" },
          ...Object.entries(PACKAGES).map(([pkg, name]) => ({
            text: name,
            link: `/reference/api/${pkg}/`,
          })),
        ],
      },
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
