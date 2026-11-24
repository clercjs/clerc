import { join } from "node:path";

import type { DefaultTheme, LocaleSpecificConfig } from "vitepress";

import { PACKAGES } from "../scripts/generate-reference.ts";
import { getNavigation } from "../utils/navigation.ts";
import { getTypedocSidebar } from "./shared.ts";

const pluginNavigation = await getNavigation(
  join(import.meta.dirname, "..", "..", "zh", "official-plugins"),
  "/zh/official-plugins",
);

const guideSidebar: DefaultTheme.Config["sidebar"] = [
  {
    text: "指南",
    items: [
      { text: "快速开始", link: "/zh/guide/getting-started" },
      { text: "命令与路由", link: "/zh/guide/commands" },
      { text: "位置参数", link: "/zh/guide/arguments" },
      { text: "选项 (Flags)", link: "/zh/guide/flags" },
      { text: "类型与 Schema", link: "/zh/guide/types" },
      { text: "中间件与状态", link: "/zh/guide/middleware" },
      { text: "插件系统", link: "/zh/guide/plugins" },
      { text: "帮助与错误诊断", link: "/zh/guide/help-and-diagnostics" },
      { text: "日志与终端 UI", link: "/zh/guide/logger" },
      { text: "测试与编程式调用", link: "/zh/guide/testing" },
    ],
  },
  {
    text: "官方插件",
    items: pluginNavigation,
  },
  {
    text: "API 参考",
    link: "/zh/reference/api/",
    items: Object.entries(PACKAGES).map(([pkg, name]) => ({
      text: name,
      link: `/zh/reference/api/${pkg}/`,
    })),
  },
];

const sidebar: DefaultTheme.Config["sidebar"] = {
  ...Object.fromEntries(
    Object.keys(PACKAGES).map((pkg) => [
      `/zh/reference/api/${pkg}/`,
      [
        {
          text: "返回指南",
          link: "/zh/guide/getting-started",
        },
        {
          text: "API 参考",
          link: `/api/${pkg}/`,
          items: getTypedocSidebar(pkg),
          base: "/zh/reference",
        },
      ],
    ]),
  ),
  "/zh/": guideSidebar,
};

export const zhConfig: LocaleSpecificConfig<DefaultTheme.Config> = {
  lang: "zh-CN",
  description:
    "面向 Node.js 24+ 的强类型 CLI 框架，内置排版级帮助、拼写纠错诊断、结构化日志、Shell 补全与 MCP 服务。",
  themeConfig: {
    siteTitle: "Clerc 文档",
    nav: [
      { text: "指南", link: "/zh/guide/getting-started" },
      { text: "官方插件", items: pluginNavigation },
      {
        text: "API 参考",
        items: [
          { text: "总览", link: "/zh/reference/api/" },
          ...Object.entries(PACKAGES).map(([pkg, name]) => ({
            text: name,
            link: `/zh/reference/api/${pkg}/`,
          })),
        ],
      },
      { text: "成员", link: "/zh/members" },
    ],
    sidebar,
    editLink: {
      text: "在 GitHub 上编辑此页",
      pattern: "https://github.com/clercjs/clerc/tree/main/docs/:path",
    },
    outline: {
      label: "本页目录",
    },
    docFooter: {
      prev: "上一页",
      next: "下一页",
    },
    footer: {
      message: "基于 MIT 许可证发布",
      copyright: "版权所有 © 2023-现在 Clerc Developers",
    },
    search: {
      provider: "local",
      options: {
        locales: {
          zh: {
            translations: {
              button: {
                buttonText: "搜索文档",
                buttonAriaLabel: "搜索文档",
              },
              modal: {
                noResultsText: "未找到相关内容",
                resetButtonTitle: "清除搜索条件",
                footer: {
                  selectText: "选择",
                  navigateText: "切换",
                },
              },
            },
          },
        },
      },
    },
  },
};
