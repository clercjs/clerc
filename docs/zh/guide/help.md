---
title: 帮助文档
---

<script setup>
import { customHelp, groupedHelp } from "../../guide/help.playground.ts";
</script>

# 帮助文档

Clerc 内置结构清晰的 `--help` 输出，包含顶部分隔线、分组标题、自动列对齐，以及不会被换行截断的元数据标签（`[default: ...]`、`[env: ...]`）。

## 命令与选项分组

使用 `.groups()` 定义分组标题，并在命令或选项上指定 `group`：

```ts
import { clerc } from "clerc";

const cli = clerc({
  name: "acme",
  version: "2.0.0",
  description: "构建与部署 TypeScript 应用",
  examples: [["$ acme build src/index.ts -p 8080", "使用自定义端口构建"]],
  notes: ["设置 NO_COLOR=1 可禁用 ANSI 颜色。"],
}).groups({
  commands: { core: "Core" },
  flags: { input: "Input Options" },
});

cli.command("build <entry>", {
  aliases: ["b"],
  group: "core",
  description: "编译源码文件",
  args: { entry: { description: "入口文件路径" } },
  flags: {
    output: { type: String, short: "o", description: "输出目录" },
    src: { type: String, group: "input", description: "源码目录" },
    cache: {
      type: Boolean,
      default: true,
      group: "input",
      description: "启用构建缓存",
    },
  },
  run() {},
});
```

<CliPlayground :scenario="groupedHelp" lang="zh" />

## 定制帮助区块与 AST

可以通过 `help.header`、`help.footer` 或 `help.sections` 按需覆写区块，也可以调用 `buildHelpDocument(cli.buildModel())` 获取结构化帮助 AST 自行渲染：

```ts
import { clerc, defaultHelpSections } from "clerc";

const cli = clerc({
  name: "acme",
  version: "2.0.0",
  help: {
    footer: (meta) => `文档: https://example.com/${meta.name}`,
    sections: {
      header: (doc, ctx) => defaultHelpSections.header(doc, ctx),
      notes: () => undefined, // 隐藏 NOTES 区块
    },
  },
});
```

在命令处理函数中，调用 `await ctx.help.print()` 可打印根帮助，传入子命令路径（如 `await ctx.help.print(["db", "migrate"])`）可打印指定命令帮助。

<CliPlayground :scenario="customHelp" lang="zh" />
