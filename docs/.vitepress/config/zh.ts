import { join } from "node:path";

import type { DefaultTheme } from "vitepress";
import { defineConfig } from "vitepress";

import { PACKAGES } from "../scripts/generate-reference";
import { getNavigation } from "../utils/navigation";
import { getTypedocSidebar } from "./shared";

const pluginNavigation = await getNavigation(
  join(import.meta.dirname, "..", "..", "zh", "official-plugins"),
  "/zh/official-plugins",
);

const guideSidebar: DefaultTheme.Config["sidebar"] = [
  {
    text: "指南",
    items: [
      {
        text: "快速开始",
        link: "/zh/guide/getting-started",
      },
      {
        text: "命令",
        link: "/zh/guide/commands",
      },
      {
        text: "上下文",
        link: "/zh/guide/context",
      },
      {
        text: "参数",
        link: "/zh/guide/parameters",
      },
      {
        text: "选项",
        link: "/zh/guide/flags",
      },
      {
        text: "全局选项",
        link: "/zh/guide/global-flags",
      },
      {
        text: "类型",
        link: "/zh/guide/types",
      },
      {
        text: "拦截器",
        link: "/zh/guide/interceptors",
      },
      {
        text: "插件",
        link: "/zh/guide/plugins",
      },
      {
        text: "错误处理",
        link: "/zh/guide/error-handling",
      },
      {
        text: "注意事项",
        link: "/zh/guide/caveats",
      },
      {
        text: "进阶用法",
        link: "/zh/guide/advanced",
      },
    ],
  },
  {
    text: "官方插件列表",
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

export const zhConfig = defineConfig({
  lang: "zh-CN",
  description: "全功能 CLI 库",
  themeConfig: {
    siteTitle: "Clerc 文档",
    nav: [
      {
        text: "指南",
        link: "/zh/guide/getting-started",
      },
      {
        text: "官方插件列表",
        items: pluginNavigation,
      },
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
      {
        text: "成员",
        link: "/zh/members",
      },
    ],
    sidebar,
    editLink: {
      text: "给本页内容提出建议",
      pattern: "https://github.com/clercjs/clerc/tree/main/docs/:path",
    },
    outline: {
      label: "本页内容",
    },
    docFooter: {
      prev: "上一页",
      next: "下一页",
    },
    footer: {
      message: "在 MIT 许可证下发布",
      copyright: "版权许可 © 2023-现在 Clerc Developers",
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
                noResultsText: "无法找到相关结果",
                resetButtonTitle: "清除查询条件",
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
});
