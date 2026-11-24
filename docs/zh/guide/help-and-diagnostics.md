---
title: 帮助与错误诊断
---

# 帮助与错误诊断

Clerc 内置排版级 `--help` 渲染器与 Cargo / Clap 风格诊断输出：单根顶部分隔线、全大写分组标题、自适应列宽对齐，以及绝不在换行处被截断的元数据标签（`[default: ...]`、`[env: ...]`）。

<CliPlayground preset="diagnostics" lang="zh" />

## 命令与选项分组

使用 `.groups()` 定义分组标题，并在命令或选项上指定 `group`：

```ts
import { clerc } from "clerc";

const cli = clerc({
  name: "acme",
  version: "2.0.0",
  description: "构建与部署现代 TypeScript 应用",
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

<TerminalWindow command="acme build --help" :lines='["{muted:acme} {brand:build} {muted:v2.0.0  alias: b}","编译源码文件","{muted:────────────────────────────────────────────────────────────────────}","{heading:USAGE}   {bold:acme build} {muted:[options]} {muted:&lt;entry&gt;}","","{heading:ARGUMENTS}","  {bold:&lt;entry&gt;}                  入口文件路径","","{heading:OPTIONS}","  {cyan:-o}{muted:, }{cyan:--output} {muted:&lt;string&gt;}    输出目录","","{heading:INPUT OPTIONS}","      {cyan:--src} {muted:&lt;string&gt;}       源码目录","      {cyan:--cache}{muted:, }{cyan:--no-cache}  启用构建缓存  {muted:[default: true]}","","{heading:GLOBAL OPTIONS}","  {cyan:-h}{muted:, }{cyan:--help}               Show help"]' />

## 定制帮助区块与 AST

可通过 `help.header`、`help.footer` 或 `help.sections` 按需覆写任意区块，也可通过 `buildHelpDocument(cli.buildModel())` 获取结构化帮助文档 AST 自行渲染：

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

## 智能拼写提示与结构化 `ClercError`

命令行用法错误退出码为 `2`，运行期与 Schema 错误退出码为 `1`。未知命令与未知选项会自动计算编辑距离并给出修复提示：

<TerminalWindow command="acme deploy prod --outpt dist" :lines='["{red:error} unexpected option: &#39;--outpt&#39;","","  {tip:tip} a similar option exists: &#39;--output&#39;","","      {muted:For more information, try &#39;acme deploy --help&#39;.}"]' />

在业务代码中抛出 `ClercError` 即可获得风格一致的 `detail`、`tip` 与 `usage` 渲染：

```ts
import { ClercError, clerc } from "clerc";

const cli = clerc({ name: "acme", version: "1.0.0" }).command("publish", {
  run() {
    throw new ClercError("尚未登录制品仓库", {
      code: "ERR_VALIDATION",
      detail: "未在 ~/.acmerc 或 ACME_TOKEN 中找到凭证",
      usage: "acme login --registry https://registry.example.com",
    }).addHint("请先运行 'acme login' 或设置环境变量 ACME_TOKEN");
  },
});
```

当 `ctx.log.format === "json"` 时，未捕获错误会自动以单行 JSON 输出到 `stderr`，便于脚本与 CI 消费。
