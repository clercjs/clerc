---
title: 日志
---

<script setup>
import scenario from "../../guide/logger.playground.ts";
</script>

# 日志

每个命令上下文内置 `ctx.log`（由 `@clerc/logger` 和 `@clerc/theme` 驱动），默认挂载 `-q, --quiet` 与 `-v, --verbose` 控制日志级别（若命令自定义了 `-q` 或 `-v` 会自动让位，也可通过 `verbosity: false` 关闭）。你也可以在任意模块中通过 `createLogger()` 独立创建日志器。

<CliPlayground :scenario="scenario" lang="zh" />

## 对齐输出与对象、Error 格式化

六个日志方法（`step`、`info`、`success`、`warn`、`error`、`debug`）统一按 5 字符宽右对齐标签，并用 `│` 缩进展示附加详情。附加参数如果是普通对象会经 `node:util` `inspect` 高亮格式化，如果是 `Error` 则自动提取堆栈并递归展示 `Caused by:` 原因链：

```ts
import { createLogger } from "clerc";

const log = createLogger({ level: "debug" });

log.step("Building targets", "entry: src/index.ts", "minify: true");
log.info("Resolved config", { port: 3000, cache: true });
log.child("db").child("migrate").debug("Query took 1.2ms");
log.error(
  new TypeError("Invalid port", {
    cause: new Error("PORT env malformed"),
  }),
);
```

<TerminalWindow title="日志输出效果" :lines='[" {brand:step} {bold:Building targets}","      {faint:│} {muted:entry: src/index.ts}","      {faint:│} {muted:minify: true}"," {cyan:info} Resolved config","      {faint:│} {muted:{ port: 3000, cache: true }}","{faint:debug db:migrate › Query took 1.2ms}","{red:error} {bold:Invalid port}","      {faint:│} {muted:TypeError: Invalid port}","      {faint:│   at ...}","      {faint:│} {muted:Caused by: Error: PORT env malformed}"]' />

`warn` 和 `error` 输出到 `stderr`；`step`、`info`、`success` 和 `debug` 输出到 `stdout`。

## 追加子行 `.line()` 与边框面板 `log.box.*`

- **追加子行**：每次日志调用都会返回可链式调用的 `LogEntry`，可在异步步骤中随时调用 `entry.line("...")` 向同一缩进竖线追加子行。
- **边框面板**：`ctx.log.box` 提供同样的六个方法，渲染与日志标签对齐的圆角边框面板（不支持 Unicode 的终端自动降级为 `+---+`）。

```ts
const step = ctx.log.step("正在执行数据库迁移");
step.line("0001_init.sql (12ms)");
step.line("0002_indexes.sql (8ms)");

ctx.log.box.info(
  "Dry run 完成",
  "未修改任何远程资源。",
  `传入 ${ctx.theme.accent("--confirm")} 执行真实发布。`,
);
```

## 运行期级别、JSON 格式与主题

可以在运行期修改 `ctx.log.level`（`"silent" | "error" | "warn" | "info" | "debug"`）或 `ctx.log.format`（`"pretty" | "json"`），也可以在 `clerc({ theme: { brand: ["bold", "cyan"] } })` 中自定义配色主题。
