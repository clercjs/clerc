---
title: 快速开始
---

# 快速开始

Clerc 是面向 Node.js 的函数式组合强类型命令行框架。`--help`、`--version`、`-v`/`-q` 日志级别、未知选项检查、拼写提示和结构化终端日志都已内置在 `clerc` 中，开箱即用。

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

## 第一个 CLI

新建 `cli.ts`：

```ts
import { Types, cli, command } from "clerc";

const deploy = command("deploy <env> [region]", {
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
      type: Types.Integer({ min: 1, max: 65_535 }),
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

const app = cli({
  name: "acme",
  version: "2.0.0",
  description: "构建与部署 TypeScript 服务",
  commands: [deploy],
});

await app.runMain();
```

将鼠标悬停在上方代码中的 `env`、`region`、`port` 或 `dryRun` 上，可以直接查看 TypeScript 根据命令签名和 Schema 推导出的真实类型。

直接运行：

<TerminalWindow command="node cli.ts deploy prod -p 8080 -n" :lines='[" {brand:step} {bold:Deploying to prod (us-east-1)}","      {faint:│} {muted:port=8080}"," {cyan:info} {faint:╭─} {bold:Dry run} {faint:───────────────────────────────╮}","      {faint:│}  {muted:No remote resources were modified.}     {faint:│}","      {faint:╰─────────────────────────────────────────╯}"]' />

## 在线交互演示

<CliPlayground demo="getting-started" variant="compact" />

## `runMain()` 与 `run()` 的区别

| 方法                           | 行为                                                                                                  | 适用场景                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `await app.runMain()`          | 默认读取 `process.argv`，报错时渲染诊断信息并设置 `process.exitCode`（不强行调用 `process.exit()`）。 | CLI 可执行入口文件（`bin`）。        |
| `await app.run(argv, options)` | 使用显式传入的 `argv` 和 `terminal` 运行，不修改 `process.exitCode`。                                 | 单元测试、命令内互相调用、MCP 服务。 |

## 包结构一览

按需安装你需要的包：

| 包名                                                                           | 用途                                                                                             |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `clerc`                                                                        | 核心组合子（`cli`、`command`、`middleware`、`group`、`use`）、POSIX 解析器、帮助输出和参数校验。 |
| `@clerc/logger`                                                                | 独立终端日志库（已由 `clerc` 重导出为 `ctx.log` 与 `createLogger`）。                            |
| `@clerc/theme`                                                                 | 零依赖语义化 ANSI 主题与终端能力检测（已由 `clerc` 重导出）。                                    |
| [`@clerc/plugin-completions`](/zh/official-plugins/plugin-completions)         | 生成并驱动 Bash、Zsh、Fish 与 PowerShell 自动补全（`completions()`）。                           |
| [`@clerc/plugin-mcp`](/zh/official-plugins/plugin-mcp)                         | 将任意 CLI 暴露为 Model Context Protocol stdio 服务器（`mcp()`）。                               |
| [`@clerc/plugin-update-notifier`](/zh/official-plugins/plugin-update-notifier) | 零依赖后台 npm 版本更新检查中间件（`updateNotifier()`）。                                        |
