---
title: 命令
---

<script setup>
import {
  defaultCommand,
  deprecated,
  stopAtFirstPositional,
  subcommands,
} from "../../guide/commands.playground.ts";
</script>

# 命令

在 Clerc 中，命令路径和位置参数直接写在 `.command()` 的签名字符串里。

## 定义命令

```ts
import { clerc } from "clerc";

const cli = clerc({
  name: "git-lite",
  version: "1.0.0",
});

cli.command("clone <repo> [dir]", {
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
```

## 多级子命令与命名空间

命令名之间用空格分隔即可定义多级子命令。没有 `run` 处理函数的父节点会自动充当**命名空间**：运行 `acme db` 会打印 `db` 下的子命令帮助，输错 `acme db migrat` 时则会提示 `db migrate`。

```ts
const cli = clerc({ name: "acme", version: "1.0.0" });

// 可选：不传 run 时作为命名空间展示帮助与分组；日后需要直接调用 db 时补上 run(ctx) 即可
cli.command("db", {
  description: "数据库管理命令",
  group: "data",
});

cli.command("db migrate", {
  aliases: "m",
  description: "执行待处理的数据库迁移",
  run(ctx) {
    ctx.calledAs; // "db migrate" 或 "db m"
    ctx.commandPath; // ["db", "migrate"]
  },
});

cli.command("db seed", {
  description: "写入开发测试数据",
  run(ctx) {
    ctx.log.success("Seeded database");
  },
});
```

全局选项出现在子命令**之前或之后**均可正确识别：`acme -v db migrate` 与 `acme db migrate -v` 等价。

<CliPlayground :scenario="subcommands" lang="zh" />

## 单命令 CLI（根命令）

像 `curl` 或 `bumpp` 这类没有子命令的工具，可以直接向 `cli.command(options)` 传入配置对象，或只写参数签名：

::: code-group

```ts [仅含选项的根命令]
import { clerc } from "clerc";

const cli = clerc({ name: "serve", version: "1.0.0" }).command({
  description: "启动静态文件服务器",
  flags: {
    port: { type: Number, short: "p", default: 3000 },
  },
  run(ctx) {
    ctx.log.info(`Listening on http://localhost:${ctx.flags.port}`);
  },
});
```

```ts [带位置参数的根命令]
import { clerc } from "clerc";

const cli = clerc({ name: "bumpp", version: "1.0.0" }).command("[files...]", {
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

## 默认子命令（`defaultCommand`）

像 `vite` 这样既有 `vite build` 子命令，又希望直接运行 `vite` 或 `vite ./my-app` 时默认走 `dev` 的工具，可在 `clerc()` 中配置 `defaultCommand`：

```ts
import { clerc } from "clerc";

const cli = clerc({
  name: "vite",
  version: "1.0.0",
  defaultCommand: "dev",
});

cli.command("dev [root]", {
  description: "启动开发服务器",
  flags: { port: { type: Number, short: "p", default: 5173 } },
  run(ctx) {
    ctx.log.info(`Serving ${ctx.args.root ?? "."} on ${ctx.flags.port}`);
  },
});

cli.command("build [root]", {
  description: "构建生产产物",
  run() {},
});
```

路由规则：

- 运行 `vite` 或 `vite -p 3000` 会执行 `dev`。
- 运行 `vite --help` 或 `vite --version` 会显示根级帮助（在 `dev` 旁标注 `[default]`）或版本号。
- 若默认命令声明了位置参数（如 `dev [root]`），`vite ./app` 会将 `./app` 转发给 `dev`。
- 若默认命令**不接受**位置参数，输错 `vite biuld` 依然会抛出 `UnknownCommandError` 并提示 `'build'`。

<CliPlayground :scenario="defaultCommand" lang="zh" />

## 透传子命令参数（`stopAtFirstPositional`）

编写类似 `npx` 或 `exec <cmd> [args...]` 的命令时，开启 `stopAtFirstPositional: true` 会在遇到第一个位置参数后停止解析选项，把后续 `--flag` 原样传给目标程序：

```ts
cli.command("exec <cmd> [args...]", {
  stopAtFirstPositional: true,
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
```

<CliPlayground :scenario="stopAtFirstPositional" lang="zh" />

## 懒加载与弃用提示

- **懒加载**：在 `async run(ctx)` 中使用 `await import("./commands/analyze.js")`，让 `--help` 和其他子命令不加载重型依赖。
- **弃用提示**：设置 `deprecated: "use 'acme create' instead"`，`--help` 会显示弃用标签，调用时自动向 `stderr` 输出警告（在 `-q` 静默模式下自动隐藏）。

<CliPlayground :scenario="deprecated" lang="zh" />
