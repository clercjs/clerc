---
title: "verbosityPlugin (内置)"
---

# `verbosityPlugin`

直接内置于 `clerc` 核心包中，无需额外安装。挂载后自动注入全局 `-q, --quiet` 与 `-v, --verbose` 选项，并通过 `{ enforce: "pre" }` 前置中间件同步更新 `ctx.log.level`，确保所有插件中间件、弃用警告和命令处理函数统一遵循日志级别。

## 用法

```ts
import { clerc, verbosityPlugin } from "clerc";

const cli = clerc({
  name: "acme",
  version: "2.0.0",
}).use(verbosityPlugin());

cli.command("sync", {
  run(ctx) {
    ctx.flags.quiet; // boolean
    ctx.flags.verbose; // number (-v -> 1, -vv -> 2)

    ctx.log.debug("传入 -v / --verbose 时可见");
    ctx.log.info("传入 -q / --quiet 时静默");
  },
});
```

## 行为对照

| 传入选项        | 对 `ctx.log.level` 的影响                                                              |
| --------------- | -------------------------------------------------------------------------------------- |
| _(未传)_        | 保持默认日志级别（`"info"`）。                                                         |
| `-q, --quiet`   | 设为 `"error"`，屏蔽所有非错误输出（包括弃用提示和更新通知框）。                       |
| `-v, --verbose` | 计数选项（`[Boolean]`）；大于 `0` 时设为 `"debug"`，同时开启错误诊断中的完整堆栈打印。 |
