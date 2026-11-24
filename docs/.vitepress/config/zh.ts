import { join } from "node:path";

import type { DefaultTheme, LocaleSpecificConfig } from "vitepress";

import { getNavigation } from "../utils/navigation.ts";

const pluginNavigation = await getNavigation(
  join(import.meta.dirname, "..", "..", "zh", "official-plugins"),
  "/zh/official-plugins",
);

const sidebar: DefaultTheme.Config["sidebar"] = [
  {
    text: "指南",
    items: [
      { text: "快速开始", link: "/zh/guide/getting-started" },
      { text: "命令", link: "/zh/guide/commands" },
      { text: "位置参数", link: "/zh/guide/arguments" },
      { text: "选项", link: "/zh/guide/flags" },
      { text: "类型与校验", link: "/zh/guide/types" },
      { text: "约束规则", link: "/zh/guide/rules" },
      { text: "中间件", link: "/zh/guide/middleware" },
      { text: "插件", link: "/zh/guide/plugins" },
    ],
  },
  {
    text: "终端输出与交互",
    items: [
      { text: "帮助文档", link: "/zh/guide/help" },
      { text: "错误处理", link: "/zh/guide/errors" },
      { text: "日志", link: "/zh/guide/logger" },
      { text: "进度与交互", link: "/zh/guide/prompts" },
    ],
  },
  {
    text: "进阶",
    items: [{ text: "测试", link: "/zh/guide/testing" }],
  },
  {
    text: "官方插件",
    items: pluginNavigation,
  },
];

export const zhConfig: LocaleSpecificConfig<DefaultTheme.Config> = {
  lang: "zh-CN",
  description:
    "面向 Node.js 的强类型 CLI 框架，内置帮助输出、拼写纠错、结构化日志、Shell 补全和 MCP 支持。",
  themeConfig: {
    siteTitle: "Clerc 文档",
    nav: [
      { text: "指南", link: "/zh/guide/getting-started" },
      { text: "官方插件", items: pluginNavigation },
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
