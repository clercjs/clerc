---
title: 命令
---

<script setup>
import {
  defaultCommand,
  deprecated,
  stopParsing,
  subcommands,
} from "../../guide/commands.playground.ts";
</script>

# 命令

在 Clerc 中，每个命令都是通过 `command(spec, options)` 创建的不可变值，最终组装进 `cli({ commands: [...] })`。

## 定义命令

```ts
import { cli, command } from "clerc";

const clone = command("clone <repo> [dir]", {
  aliases: ["c"],
  description: "克隆仓库到指定目录",
  flags: {
    depth: { type: Number, description: "浅克隆深度" },
  },
  run(ctx) {
    ctx.args.repo;
    //       ^?
    ctx.args.dir;
    //       ^?
    ctx.log.info(`Cloning ${ctx.args.repo} into ${ctx.args.dir ?? "."}`);
  },
});

const app = cli({
  name: "git-lite",
  version: "1.0.0",
  commands: [clone],
});
```

## 多级子命令与命名空间

在父命令的 `commands: [...]` 中嵌套子命令即可构建命令树。没有 `run` 处理函数且未指定 `default` 的父节点会自动充当**命名空间**：运行 `acme db` 会打印 `db` 下的子命令帮助，输错 `acme db migrat` 时则会提示 `db migrate`。

```ts
import { cli, command } from "clerc";

const dbMigrate = command("migrate", {
  aliases: ["m", "db-migrate"],
  description: "执行待处理的数据库迁移",
  run(ctx) {
    ctx.calledAs; // "db migrate" 或 "db m"
    ctx.commandPath; // ["db", "migrate"]
  },
});

const dbSeed = command("seed", {
  description: "写入开发测试数据",
  run(ctx) {
    ctx.log.success("Seeded database");
  },
});

const db = command("db", {
  description: "数据库管理命令",
  commands: [dbMigrate, dbSeed],
});

const app = cli({
  name: "acme",
  version: "1.0.0",
  commands: [db],
});
```

单词别名注册在当前父命名空间下（如 `acme db m`），多词别名则会从根路径开始注册（如 `aliases: ["db m"]`）。全局或父级选项出现在子命令**之前或之后**均可正确识别：`acme -v db migrate` 与 `acme db migrate -v` 等价。

<CliPlayground :scenario="subcommands" lang="zh" />

## 词法作用域组合（`use` 与 `group`）

使用 `use(middlewares, commands)` 可以把共享选项、`setup` 状态、生命周期钩子与 `onError` 限定在一组子命令上，绝不污染同级的其他命令；搭配 `group(title, commands)` 即可在 `--help` 中按分组归类：

```ts
import { cli, command, group, middleware, use } from "clerc";

const withAuth = middleware({
  flags: { token: { type: String, required: true, env: "ACME_TOKEN" } },
  setup: (ctx) => ({ token: ctx.flags.token }),
});

const deploy = command("deploy", {
  use: [withAuth],
  run(ctx) {
    ctx.log.info(`Deploying with ${ctx.state.token}`);
  },
});

const serve = command("serve", {
  run(ctx) {
    // 完全不受 withAuth 影响（既不要求也不接受 --token）
    ctx.log.info("Starting local server");
  },
});

const app = cli({
  name: "acme",
  version: "1.0.0",
  commands: [group("Admin", use(withAuth, [deploy])), group("Local", [serve])],
});
```

`commands: [...]` 会自动拍平任意层级的嵌套数组，因此 `group(...)` 与 `use(...)` 可以直接套用，无需写 `...` 展开。

## 单命令 CLI

像 `curl` 或 `bumpp` 这类没有子命令的工具，直接在 `cli(options)` 或 `cli(spec, options)` 上提供 `run` 即可：

::: code-group

```ts [仅含选项]
import { cli } from "clerc";

const app = cli({
  name: "serve",
  version: "1.0.0",
  description: "启动静态文件服务器",
  flags: {
    port: { type: Number, short: "p", default: 3000 },
  },
  run(ctx) {
    ctx.log.info(`Listening on http://localhost:${ctx.flags.port}`);
  },
});
```

```ts [带位置参数]
import { cli } from "clerc";

const app = cli("[files...]", {
  name: "bumpp",
  version: "1.0.0",
  description: "升级版本号",
  flags: {
    yes: { type: Boolean, short: "y" },
  },
  run(ctx) {
    ctx.args.files;
    //       ^?
  },
});
```

:::

## 默认子命令（`default`）

像 `vite` 这样既有 `vite build` 子命令，又希望直接运行 `vite` 或 `vite ./my-app` 时默认走 `dev` 的工具，直接把子命令对象传给 `cli()` 或命名空间 `command()` 的 `default` 字段：

```ts
import { cli, command } from "clerc";

const dev = command("dev [root]", {
  description: "启动开发服务器",
  flags: { port: { type: Number, short: "p", default: 5173 } },
  run(ctx) {
    ctx.log.info(`Serving ${ctx.args.root ?? "."} on ${ctx.flags.port}`);
  },
});

const build = command("build [root]", {
  description: "构建生产产物",
  run() {},
});

const app = cli({
  name: "vite",
  version: "1.0.0",
  commands: [dev, build],
  default: dev,
});
```

路由规则：

- 运行 `vite` 或 `vite -p 3000` 会执行 `dev`。
- 运行 `vite --help` 或 `vite --version` 会显示根级帮助（在 `dev` 旁标注 `[default]`）或版本号。
- 若默认命令声明了位置参数（如 `dev [root]`），`vite ./app` 会将 `./app` 转发给 `dev`。
- 若默认命令**不接受**位置参数，输错 `vite biuld` 依然会抛出 `UnknownCommandError` 并提示 `'build'`。
- 如果父命令自身有一套独立于子命令的参数签名（如 `pr [id]` 搭配 `pr ls`），则直接在父命令上写 `command("pr [id]", { commands: [prLs], run })`。

<CliPlayground :scenario="defaultCommand" lang="zh" />

## 透传子命令参数（`stopParsing`）

编写类似 `npx` 或透传包装命令时，可以通过 `stopParsing` 指定何时停止解析选项。一旦触发，从该 token 起的所有剩余参数都会作为原始位置参数绑定到 `ctx.args`：

- `"first-positional"`：遇到第一个位置参数时停止解析选项（适合 `exec <cmd> [args...]`）。
- `"unknown-flag"`：遇到第一个未知选项时停止解析，原样透传后续参数，不触发 `UnknownFlagError`。
- `(token) => boolean`：无状态判断函数，接收 `{ kind, raw, index, positionalCount }`，可用于在第 N 个位置参数或自定义分隔符处截停。

```ts
const execCmd = command("exec <cmd> [args...]", {
  stopParsing: "first-positional",
  flags: {
    quiet: { type: Boolean, short: "q" },
  },
  run(ctx) {
    // $ acme exec -q git --status -s
    // ctx.flags.quiet -> true
    // ctx.args.cmd    -> "git"
    // ctx.args.args   -> ["--status", "-s"]
  },
});

const runCmd = command("run <env> <script> [args...]", {
  stopParsing: (token) =>
    token.kind === "positional" && token.positionalCount === 1,
  flags: { verbose: Boolean },
  run(ctx) {
    // $ acme run prod --verbose app.ts --port 3000
    // ctx.flags.verbose -> true
    // ctx.args.env      -> "prod"
    // ctx.args.script   -> "app.ts"
    // ctx.args.args     -> ["--port", "3000"]
  },
});
```

<CliPlayground :scenario="stopParsing" lang="zh" />

## 隐藏命令、动态帮助元数据与懒加载

- **隐藏命令（`hidden: true`）**：从 `--help`、拼写建议、Shell 补全与 MCP 工具中隐藏（除非显式配置 `meta.mcp.enabled: true`），但仍可直接执行（适合内部辅助命令）。
- **动态 `examples` 与 `notes`**：两者均支持传入静态数组，或接收 `CliMeta`（`name`、`version`、`description`）的同步/异步函数 `(meta) => [...]`。
- **懒加载**：在 `async run(ctx)` 中动态 `await import("./commands/analyze.js")`，让 `--help` 和其他子命令不加载重型依赖。
- **弃用提示**：设置 `deprecated: "use 'acme create' instead"`，`--help` 会显示弃用标签，调用时自动向 `stderr` 输出警告（在 `-q` 静默模式下自动隐藏）。

```ts
const analyze = command("analyze <entry>", {
  description: "分析打包产物大小",
  examples: (meta) => [[`$ ${meta.name} analyze src/index.ts`, "分析指定入口"]],
  async run(ctx) {
    const { runBundleAnalysis } = await import("./commands/analyze.js");
    await runBundleAnalysis(ctx);
  },
});
```

<CliPlayground :scenario="deprecated" lang="zh" />
