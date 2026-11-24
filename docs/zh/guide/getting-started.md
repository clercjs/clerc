---
title: 快速开始
---

# 快速开始

Clerc 是面向 **Node.js 24+** 的纯 ESM 命令行框架。`--help`、`--version`、未知选项拦截、拼写相近提示与结构化终端日志均直接内置在 `clerc` 核心包中，无需堆叠基础插件。

## 安装

::: code-group

```sh [pnpm]
pnpm add clerc
```

```sh [npm]
npm install clerc
```

```sh [yarn]
yarn add clerc
```

:::

## 30 秒写出第一个 CLI

新建 `cli.ts`：

```ts
import { Types, clerc } from "clerc";

const cli = clerc({
  name: "acme",
  version: "2.0.0",
  description: "构建与部署 TypeScript 服务",
});

cli.command("deploy <env> [region]", {
  aliases: "d",
  description: "部署服务到目标环境",
  args: {
    env: {
      type: Types.Enum("staging", "prod"),
      description: "目标环境",
    },
    region: {
      default: "us-east-1",
      description: "云区域",
    },
  },
  flags: {
    port: {
      type: Types.Range(1, 65_535),
      short: "p",
      default: 3000,
      env: "PORT",
      description: "服务端口",
    },
    dryRun: {
      type: Boolean,
      short: "n",
      description: "仅预览不实际执行",
    },
  },
  run(ctx) {
    const { env, region } = ctx.args;
    //      ^?
    const { port, dryRun } = ctx.flags;
    //      ^?

    ctx.log.step(`Deploying to ${env} (${region})`, `port=${port}`);
    if (dryRun) {
      ctx.log.box.info("Dry run", "No remote resources were modified.");
    } else {
      ctx.log.success("Deployment complete");
    }
  },
});

await cli.runMain();
```

将鼠标悬停在上方代码中的 `env`、`region`、`port` 或 `dryRun` 上，可以直接查看 TypeScript 根据命令签名和 Schema 推导出的真实类型。

使用 Node.js 24+ 原生 TypeScript 支持直接运行：

<TerminalWindow command="node cli.ts deploy prod -p 8080 -n" :lines='[" {brand:step} {bold:Deploying to prod (us-east-1)}","      {faint:│} {muted:port=8080}"," {cyan:info} {faint:╭─} {bold:Dry run} {faint:───────────────────────────────╮}","      {faint:│}  {muted:No remote resources were modified.}     {faint:│}","      {faint:╰─────────────────────────────────────────╯}"]' />

## 在线交互沙盒

直接在这里尝试运行 `--help`、组合不同选项或故意输错命令名：

<CliPlayground lang="zh" />

## `runMain()` 与 `run()` 的区别

| 方法                           | 行为                                                                                                  | 适用场景                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `await cli.runMain()`          | 默认读取 `process.argv`，报错时渲染诊断信息并设置 `process.exitCode`（不强行调用 `process.exit()`）。 | CLI 可执行入口文件（`bin`）。        |
| `await cli.run(argv, options)` | 针对显式传入的 `argv` 与 `terminal` 执行，不修改 `process.exitCode`。                                 | 单元测试、命令内互相调用、MCP 服务。 |

## 包结构一览

按需安装你需要的包：

| 包名                                                                   | 用途                                                                                                            |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `clerc`                                                                | 核心路由器、POSIX 参数解析器、帮助与诊断系统、Standard Schema v1、`verbosityPlugin` 与 `updateNotifierPlugin`。 |
| `@clerc/logger`                                                        | 独立终端日志库（已由 `clerc` 重导出为 `ctx.log` 与 `createLogger`）。                                           |
| `@clerc/theme`                                                         | 零依赖语义化 ANSI 主题与终端能力检测（已由 `clerc` 重导出）。                                                   |
| [`@clerc/plugin-completions`](/zh/official-plugins/plugin-completions) | 生成并驱动 Bash、Zsh、Fish 与 PowerShell 自动补全。                                                             |
| [`@clerc/plugin-mcp`](/zh/official-plugins/plugin-mcp)                 | 将任意 CLI 暴露为 Model Context Protocol stdio 服务器（`<cli> mcp`）。                                          |
