import { join } from "node:path";

import { defineConfig } from "vitepress";

import { PACKAGES } from "../scripts/generate-reference";
import { getNavigation } from "../utils/navigation";
import { getTypedocSidebar } from "./shared";

const pluginNavigation = await getNavigation(
  join(import.meta.dirname, "..", "..", "official-plugins"),
  "/official-plugins",
);

const guideSidebar = [
  {
    text: "Guide",
    items: [
      {
        text: "Getting Started",
        link: "/guide/getting-started",
      },
      {
        text: "Commands",
        link: "/guide/commands",
      },
      {
        text: "Context",
        link: "/guide/context",
      },
      {
        text: "Parameters",
        link: "/guide/parameters",
      },
      {
        text: "Flags",
        link: "/guide/flags",
      },
      {
        text: "Global Flags",
        link: "/guide/global-flags",
      },
      {
        text: "Types",
        link: "/guide/types",
      },
      {
        text: "Interceptors",
        link: "/guide/interceptors",
      },
      {
        text: "Plugins",
        link: "/guide/plugins",
      },
      {
        text: "Error Handling",
        link: "/guide/error-handling",
      },
      {
        text: "Advanced Usage",
        link: "/guide/advanced",
      },
    ],
  },
  {
    text: "Official Plugins",
    items: pluginNavigation,
  },
  {
    text: "API Reference",
    items: Object.entries(PACKAGES).map(([pkg, name]) => ({
      text: name,
      link: `/reference/api/${pkg}/`,
    })),
  },
];

const sidebar = {
  ...Object.fromEntries(
    Object.keys(PACKAGES).map((pkg) => [
      `/reference/api/${pkg}/`,
      [
        {
          text: "Go back to guide",
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

export const enConfig = defineConfig({
  lang: "en-US",
  description: "The The full-featured Command-Line Interface library",
  themeConfig: {
    siteTitle: "Clerc Docs",
    nav: [
      {
        text: "Guide",
        link: "/guide/getting-started",
      },
      {
        text: "Official Plugins",
        items: pluginNavigation,
      },
      {
        text: "Members",
        link: "/members",
      },
    ],
    sidebar,
    editLink: {
      text: "Suggest to this page",
      pattern: "https://github.com/clercjs/clerc/tree/main/docs/:path",
    },
    outline: {
      label: "This page",
    },
    docFooter: {
      prev: "Previous",
      next: "Next",
    },
    footer: {
      message: "Released under the MIT license",
      copyright: "Copyright © 2023-present Clerc Developers",
    },
  },
});
