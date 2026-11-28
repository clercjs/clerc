---
title: 上下文
---

# 上下文

每个命令处理函数、中间件和错误拦截器都会收到强类型的上下文对象 `ctx`。终端读写、环境变量、帮助输出与进程退出都经由 `ctx` 注入，不依赖全局 `process.*`，因此命令天然可测试、可重入。

## 上下文类型层级

Clerc 按执行阶段逐步收窄上下文类型：

| 类型                                    | 使用位置                     | 类型保证                                                                       |
| --------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------ |
| `CliContext<TFlags, TState>`            | `onError(err, ctx)`          | 解析或路由失败时也会触发，`command`、`calledAs`、`flags`、`state` 可能不完整。 |
| `MiddlewareContext<TFlags, TState>`     | `middleware` `setup` / `run` | `command`、`calledAs`、`flags` 与 `state` 均已解析并完成类型推导。             |
| `CommandContext<TArgs, TFlags, TState>` | `command` / `cli` `run`      | 在此基础上补充由命令签名与 `args` 推导出的强类型 `args`。                      |

### `ctx` 内置属性一览

| 属性              | 类型                                     | 说明                                                                                                                            |
| ----------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `ctx.args`        | `TArgs`                                  | 已解析并完成校验的位置参数。                                                                                                    |
| `ctx.flags`       | `TFlags`                                 | 已解析并完成校验的命令、中间件与全局选项。                                                                                      |
| `ctx.state`       | `State<TState>`                          | 上游中间件 `setup()` 注入的强类型状态。                                                                                         |
| `ctx.log`         | `Logger`                                 | 结构化日志器，提供 `step`、`info`、`success`、`warn`、`error`、`debug`、`box`、`task`、`spinner`、`raw`、`child`。              |
| `ctx.terminal`    | `Terminal`                               | 抽象终端对象：`stdout`、`stderr`、`env`、`argv`、`cwd()`、`isTTY`、`isInputTTY`、`readStdin()`、`color`、`unicode`、`columns`。 |
| `ctx.help`        | `{ render, print }`                      | 渲染或打印根帮助及任意子命令帮助。                                                                                              |
| `ctx.run`         | `(argv, options?) => Promise<RunResult>` | 在当前 CLI 实例上可重入地调用其他命令。                                                                                         |
| `ctx.exit`        | `(code?: number) => never`               | 以指定退出码优雅提前退出，不直接调用 `process.exit()`。                                                                         |
| `ctx.command`     | `Command`                                | 命中的 `Command` 定义（含 `meta`）。                                                                                            |
| `ctx.commandPath` | `readonly string[]`                      | 规范化命令路径数组（如 `["db", "migrate"]`）。                                                                                  |
| `ctx.calledAs`    | `string`                                 | 用户实际输入的命令名或别名（如 `"db m"`）。                                                                                     |
| `ctx.model`       | `CliModel`                               | 编译后的只读模型（`meta`、`tree`、`globalFlags`、`groups`）。                                                                   |
| `ctx.raw`         | `{ argv, unknown, doubleDash }`          | 原始 `argv`、未知选项（`strictFlags: false` 时）以及 `--` 之后的透传参数。                                                      |

## 优雅提前退出（`ctx.exit`）

当命令需要自行打印结果并以指定退出码结束（例如格式检查工具发现差异后返回退出码 `3`），且不希望触发错误诊断输出或直接中断进程时，调用 `ctx.exit(code)`：

```ts
import { command } from "clerc";

const checkFormat = command("format-check", {
  flags: { ok: Boolean },
  run(ctx) {
    if (ctx.flags.ok) {
      ctx.exit(0);
    }

    ctx.log.warn("发现 3 个文件未格式化");
    ctx.exit(3);
  },
});
```

- 外层中间件的 `finally` 清理块仍会正常执行。
- **不会**触发 `onError`（需要输出错误诊断请 `throw new ClercError(...)`）。
- `app.run()` 会返回 `{ ok: code === 0, exitCode: code }`，`app.runMain()` 会据此设置 `process.exitCode`。

## 读取管道输入（`ctx.terminal.readStdin`）

结合 `ctx.terminal.isInputTTY` 与 `await ctx.terminal.readStdin()`，可以优雅支持 UNIX 管道输入（如 `cat a.ts | acme lint`）：

```ts
import { command } from "clerc";

const lint = command("lint [file]", {
  async run(ctx) {
    if (!ctx.args.file && !ctx.terminal.isInputTTY) {
      const source = await ctx.terminal.readStdin();
      ctx.log.info(`从标准输入读取了 ${source.length} 字节`);

      return;
    }

    ctx.log.info(`正在检查 ${ctx.args.file ?? "."}`);
  },
});
```

单元测试中只需传入 `createMemoryTerminal({ stdin: "hello\n" })`，会自动将 `isInputTTY` 置为 `false` 并通过 `readStdin()` 返回模拟内容。

## 命令内调用其他子命令（`ctx.run`）

在命令或中间件内，可通过 `await ctx.run(argv, options)` 可重入地调用同一个 CLI 下的其他命令：

```ts
import { command } from "clerc";

const release = command("release", {
  async run(ctx) {
    const buildRes = await ctx.run(["build", "--minify"], {
      terminal: ctx.terminal,
    });
    if (!buildRes.ok) {
      ctx.exit(buildRes.exitCode);
    }
    ctx.log.success("发布准备就绪");
  },
});
```

## 非严格选项模式与 `ctx.raw`

`strictFlags` 默认为 `true`，遇到未声明选项会抛出 `UnknownFlagError` 并给出拼写建议。设为 `false` 后，未知选项会被收集到 `ctx.raw.unknown`：

```ts
import { cli, command } from "clerc";

const proxy = command("proxy", {
  run(ctx) {
    ctx.raw.argv; // 传入 run() 的原始参数数组
    ctx.raw.unknown; // 例如 { extra: "1", debug: true }
    ctx.raw.doubleDash; // "--" 之后的原始参数
  },
});

const app = cli({
  name: "acme",
  version: "1.0.0",
  strictFlags: false,
  commands: [proxy],
});
```

## `cli()` 全局配置项一览

| 配置项        | 类型                              | 默认值  | 说明                                                                               |
| ------------- | --------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| `name`        | `string`                          | `"cli"` | 程序名称，用于 `--help`、`--version`、错误提示、补全脚本与 MCP 服务。              |
| `version`     | `string`                          | `""`    | 非空时自动启用 `-V, --version` 与 `version` 子命令。                               |
| `description` | `string`                          | `""`    | CLI 简介，展示在帮助首页与 MCP 资源中。                                            |
| `examples`    | `MetaAsyncGetter<ExampleInput[]>` | —       | 根级帮助示例（支持静态数组或 `(meta) => ...` 同步/异步函数）。                     |
| `notes`       | `MetaAsyncGetter<string[]>`       | —       | 根级帮助说明（支持静态数组或 `(meta) => ...` 同步/异步函数）。                     |
| `help`        | `boolean \| HelpOptions`          | `true`  | 定制帮助区块、页眉页脚或完整渲染器，也可设为 `false` 关闭。                        |
| `verbosity`   | `boolean`                         | `true`  | 自动注册 `-v, --verbose`（`debug`）与 `-q, --quiet`（`error`），冲突时让位。       |
| `strictFlags` | `boolean`                         | `true`  | 未知选项默认报错；设为 `false` 则收入 `ctx.raw.unknown`。                          |
| `theme`       | `Partial<ThemeStyleMap>`          | —       | 全局覆写帮助、错误诊断与 `ctx.log` 的 ANSI 样式主题。                              |
| `logger`      | `LoggerOptions`                   | —       | 传给 `ctx.log` 的默认 `level` 与 `scope`。                                         |
| `use`         | `Middleware[]`                    | `[]`    | 作用于所有用户命令的全局中间件。                                                   |
| `flags`       | `FlagsInput`                      | `{}`    | 所有用户命令继承的全局选项、分组与约束。                                           |
| `check`       | `CheckInput`                      | —       | 在中间件前执行的全局跨字段校验函数。                                               |
| `onError`     | `ErrorHandler`                    | —       | 根级兜底错误拦截器。                                                               |
| `commands`    | `CommandItem[]`                   | `[]`    | 子命令列表，自动拍平嵌套数组、`group(...)`、`use(...)`、`completions()`、`mcp()`。 |
| `default`     | `Command`                         | —       | 不传子命令时默认执行的子命令（与 `run` 互斥）。                                    |
| `run`         | `CommandHandler`                  | —       | 单命令 CLI 的根执行函数（与 `default` 互斥）。                                     |

::: tip 内置选项自动让位
内置的 `-h, --help`、`-V, --version`、`-v, --verbose` 与 `-q, --quiet` 在遇到同名用户选项或短别名冲突时会自动让位。例如命令定义了 `host: { type: String, short: "h" }` 时，`-h` 会分配给 `--host`，而 `--help` 仍保留长选项形式可用。
:::
