import type { PropType } from "vue";
import { defineComponent, h, onBeforeUnmount, ref } from "vue";

import defaultScenario from "../../guide/getting-started.playground.ts";
import { CliPlayground } from "./CliPlayground.ts";

interface SpecItem {
  readonly title: string;
  readonly summary: string;
  readonly href: string;
}

const EN_ITEMS: readonly SpecItem[] = [
  {
    title: "Commands and Routing",
    summary:
      "Subcommands, aliases, namespaces, and typed <required>, [optional], and [variadic...] arguments.",
    href: "/guide/commands",
  },
  {
    title: "Standard Schema v1",
    summary:
      "Built-in Types, or pass Zod, Valibot, and ArkType schemas directly.",
    href: "/guide/types",
  },
  {
    title: "Help and Diagnostics",
    summary:
      "Grouped --help output, standard exit codes, and typo suggestions.",
    href: "/guide/help",
  },
  {
    title: "Logger and Terminal UI",
    summary:
      "Aligned terminal logs, callout boxes, spinners, prompts, and JSON output.",
    href: "/guide/logger",
  },
  {
    title: "Plugins and Middleware",
    summary:
      "Shared plugin() API and onion middleware that injects typed ctx.state.",
    href: "/guide/middleware",
  },
  {
    title: "Completions and MCP",
    summary:
      "Generate shell tab completions and expose stdio MCP tools from one definition.",
    href: "/official-plugins/plugin-completions",
  },
];

const ZH_ITEMS: readonly SpecItem[] = [
  {
    title: "命令与路由",
    summary:
      "支持子命令、别名、命名空间，以及带类型推导的 <必填>、[可选] 和 [可变...] 参数。",
    href: "/zh/guide/commands",
  },
  {
    title: "Standard Schema v1",
    summary: "内置常用校验类型 Types，也可直接使用 Zod、Valibot 或 ArkType。",
    href: "/zh/guide/types",
  },
  {
    title: "帮助与错误诊断",
    summary: "分组 --help 输出、规范退出码和拼写纠错提示。",
    href: "/zh/guide/help",
  },
  {
    title: "日志与终端 UI",
    summary: "对齐的终端日志、圆角提示框、Spinner、交互提问和 JSON 输出。",
    href: "/zh/guide/logger",
  },
  {
    title: "插件与中间件",
    summary:
      "应用和插件共用同一套链式 API，通过洋葱中间件向 ctx.state 注入类型化状态。",
    href: "/zh/guide/middleware",
  },
  {
    title: "自动补全与 MCP",
    summary: "基于同一份命令定义生成 Shell 自动补全脚本和 MCP 服务。",
    href: "/zh/official-plugins/plugin-completions",
  },
];

export const HomeLanding = defineComponent({
  name: "HomeLanding",
  props: {
    lang: {
      type: String as PropType<"en" | "zh">,
      default: "en",
    },
  },
  setup(props) {
    const copied = ref(false);
    let resetTimer: ReturnType<typeof setTimeout> | undefined;

    onBeforeUnmount(() => {
      if (resetTimer !== undefined) {
        clearTimeout(resetTimer);
      }
    });

    async function copyInstall(): Promise<void> {
      try {
        await navigator.clipboard.writeText("pnpm add clerc");
        copied.value = true;
        if (resetTimer !== undefined) {
          clearTimeout(resetTimer);
        }
        resetTimer = setTimeout(() => {
          copied.value = false;
        }, 1800);
      } catch {
        // Ignore clipboard errors in restricted contexts
      }
    }

    return () => {
      const isZh = props.lang === "zh";
      const items = isZh ? ZH_ITEMS : EN_ITEMS;

      return h("div", { class: "clerc-home" }, [
        h("header", { class: "clerc-hero" }, [
          h("div", { class: "clerc-hero-brand" }, [
            h("img", {
              src: "/logo.webp",
              alt: "",
              width: 28,
              height: 28,
              class: "clerc-hero-logo",
            }),
            h("span", { class: "clerc-hero-name" }, "Clerc"),
            h("span", { class: "clerc-hero-badge" }, "v2"),
          ]),
          h(
            "h1",
            { class: "clerc-hero-title" },
            isZh ? "面向 Node.js 的强类型 CLI 框架" : "Typed CLIs for Node.js",
          ),
          h(
            "p",
            { class: "clerc-hero-lead" },
            isZh
              ? "用路由式签名和 Standard Schema 定义一次命令，自动得到参数解析、TypeScript 类型、--help、错误提示、Shell 补全和 MCP 工具。"
              : "Define commands once with route signatures and Standard Schema. Parsing, types, help output, completions, and MCP derive from one definition.",
          ),
          h("div", { class: "clerc-hero-actions" }, [
            h(
              "a",
              {
                href: isZh
                  ? "/zh/guide/getting-started"
                  : "/guide/getting-started",
                class: "clerc-btn-primary",
              },
              isZh ? "快速开始" : "Get Started",
            ),
            h(
              "button",
              {
                "type": "button",
                "class": ["clerc-install", { copied: copied.value }],
                "aria-label": isZh
                  ? "复制安装命令 pnpm add clerc"
                  : "Copy install command pnpm add clerc",
                "onClick": copyInstall,
              },
              [
                h(
                  "span",
                  { "class": "clerc-install-dollar", "aria-hidden": "true" },
                  "$",
                ),
                h("code", "pnpm add clerc"),
                copied.value
                  ? h(
                      "svg",
                      {
                        "class": "clerc-install-icon",
                        "viewBox": "0 0 16 16",
                        "width": 14,
                        "height": 14,
                        "fill": "none",
                        "stroke": "currentColor",
                        "stroke-width": "1.8",
                        "stroke-linecap": "round",
                        "stroke-linejoin": "round",
                        "aria-hidden": "true",
                      },
                      [h("path", { d: "M3.2 8.5 6.5 11.8 12.8 4.5" })],
                    )
                  : h(
                      "svg",
                      {
                        "class": "clerc-install-icon",
                        "viewBox": "0 0 16 16",
                        "width": 14,
                        "height": 14,
                        "fill": "none",
                        "stroke": "currentColor",
                        "stroke-width": "1.5",
                        "stroke-linecap": "round",
                        "stroke-linejoin": "round",
                        "aria-hidden": "true",
                      },
                      [
                        h("rect", {
                          x: "5.5",
                          y: "5.5",
                          width: "8",
                          height: "8",
                          rx: "1.5",
                        }),
                        h("path", {
                          d: "M10.5 5.5V3.8A1.3 1.3 0 0 0 9.2 2.5H3.8A1.3 1.3 0 0 0 2.5 3.8v5.4a1.3 1.3 0 0 0 1.3 1.3h1.7",
                        }),
                      ],
                    ),
              ],
            ),
          ]),
        ]),

        h("div", { class: "clerc-home-stage" }, [
          h(CliPlayground, {
            lang: props.lang,
            variant: "split",
            scenario: defaultScenario,
          }),
        ]),

        h(
          "nav",
          {
            "class": "clerc-specs",
            "aria-label": isZh ? "核心模块" : "Core capabilities",
          },
          items.map((item) =>
            h("a", { key: item.href, href: item.href, class: "clerc-spec" }, [
              h("span", { class: "clerc-spec-head" }, [
                h("span", { class: "clerc-spec-title" }, item.title),
                h(
                  "span",
                  { "class": "clerc-spec-arrow", "aria-hidden": "true" },
                  "→",
                ),
              ]),
              h("span", { class: "clerc-spec-desc" }, item.summary),
            ]),
          ),
        ),
      ]);
    };
  },
});
