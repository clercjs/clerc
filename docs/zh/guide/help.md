---
title: 帮助文档
---

# 帮助文档

Clerc 内置结构清晰的 `--help` 输出，包含分组标题、自动列对齐，以及不会被换行截断的元数据标签（`[default: ...]`、`[env: ...]`）。

## 命令与选项分组

使用重载组合子 `group(title, target)`，既可以在 `commands: [...]` 中为命令分组，也可以在 `flags: [...]` 中为选项分组：

```ts
import { cli, command, group } from "clerc";

const build = command("build <entry>", {
  aliases: ["b"],
  description: "编译源码文件",
  args: { entry: { description: "入口文件路径" } },
  flags: [
    { output: { type: String, short: "o", description: "输出目录" } },
    group("Input Options", {
      src: { type: String, description: "源码目录" },
      cache: {
        type: Boolean,
        default: true,
        description: "启用构建缓存",
      },
    }),
  ],
  run() {},
});

const app = cli({
  name: "acme",
  version: "2.0.0",
  description: "构建与部署 TypeScript 应用",
  examples: [["$ acme build src/index.ts -o dist", "指定输出目录构建"]],
  notes: ["设置 NO_COLOR=1 可禁用 ANSI 颜色。"],
  commands: [group("Core", [build])],
});
```

<CliPlayground demo="help/groupedHelp" />

## 定制帮助区块与渲染器

传入 `help: false` 可彻底关闭内置 `--help` 与 `help` 子命令；传入 `HelpOptions` 对象可按需定制：

| 配置项     | 类型                                                 | 说明                                                                                                                     |
| ---------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `command`  | `boolean`                                            | 设为 `false` 时保留 `-h, --help`，但禁用内置 `help` 子命令。                                                             |
| `header`   | `MetaAsyncGetter<string \| void>`                    | 帮助顶部页眉（支持静态字符串或同步/异步 `(meta) => string`）。                                                           |
| `footer`   | `MetaAsyncGetter<string \| void>`                    | 帮助底部页脚（支持静态字符串或同步/异步 `(meta) => string`）。                                                           |
| `sections` | `Partial<HelpSectionRenderers>`                      | 覆写或隐藏 8 个内置区块（`header`、`usage`、`arguments`、`commands`、`options`、`globalOptions`、`examples`、`notes`）。 |
| `render`   | `(model, commandPath?) => string \| Promise<string>` | 完全替换帮助渲染器，同时保留 `--help` 路由拦截。                                                                         |

```ts
import { cli, defaultHelpSections } from "clerc";

const app = cli({
  name: "acme",
  version: "2.0.0",
  help: {
    command: true,
    footer: (meta) => `文档: https://example.com/${meta.name}`,
    sections: {
      header: (doc, ctx) => defaultHelpSections.header(doc, ctx),
      notes: () => undefined, // 隐藏 NOTES 区块
    },
  },
});
```

在命令处理函数中，调用 `await ctx.help.print()`（或 `await ctx.help.render()`）可输出根帮助，传入子命令路径（如 `await ctx.help.print(["db", "migrate"])`）可输出指定命令帮助。在运行外部需要离线生成帮助文本时，可直接调用 `buildHelpDocument(model, node?)`、`renderHelpDocument(doc, options)` 或 `renderHelp(model, options)`。

<CliPlayground demo="help/customHelp" />

## 主题样式定制（`@clerc/theme`）

帮助输出、错误诊断与 `ctx.log` 共用一套基于 Node 原生 `node:util` `styleText` 的零依赖主题系统。通过 `cli({ theme: { ... } })` 或单次 `app.run(argv, { theme })` 可覆写任意样式 token：

| Token          | 默认样式                | 用途                                    |
| -------------- | ----------------------- | --------------------------------------- |
| `brand`        | `"bold"`                | CLI / 命令标题与 `step` 日志标签。      |
| `heading`      | `["bold", "underline"]` | 帮助区块标题（`USAGE`、`OPTIONS` 等）。 |
| `command`      | `"bold"`                | 命令名与位置参数 token。                |
| `flag`         | `"bold"`                | 选项名（`-p`、`--port`）。              |
| `placeholder`  | `"gray"`                | 值占位符（`<number>`、`<env>`）。       |
| `muted`        | `"gray"`                | 元数据标签、说明与次要文本。            |
| `error`        | `["bold", "red"]`       | 错误标签与诊断标题。                    |
| `warn`         | `"yellow"`              | 弃用标签与警告提示。                    |
| `success`      | `"green"`               | 成功标签。                              |
| `info`         | `"cyan"`                | 信息标签。                              |
| `accent`       | `"cyan"`                | 诊断 `tip` 提示与高亮命令。             |
| `code`         | `"bold"`                | 行内代码片段。                          |
| `bold` / `dim` | `"bold"` / `"dim"`      | 常规加粗与弱化修饰。                    |

颜色输出会自动遵循 `NO_COLOR`、`FORCE_COLOR`、`CI` 与 TTY 检测。
