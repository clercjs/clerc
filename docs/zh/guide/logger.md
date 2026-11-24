---
title: 日志与终端 UI
---

# 日志与终端 UI

每个命令上下文内置 `ctx.log`（由 `@clerc/logger` 与 `@clerc/theme` 驱动），也可以在任意模块中通过 `createLogger()` 独立创建。

## 对齐左脊排版与对象 / Error 渲染

全部六个日志方法（`step`、`info`、`success`、`warn`、`error`、`debug`）共享 5 字符宽右对齐词标与 `│` 详情导轨。附加参数如果是普通对象会经 `node:util` `inspect` 高亮格式化，如果是 `Error` 则自动提取堆栈并递归展示 `Caused by:` 原因链：

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

## 流式追加 `.line()` 与同构 `log.box.*`

- **流式追加**：每次日志调用都会返回支持链式调用的 `LogEntry`，可在异步步骤执行过程中随时调用 `entry.line("...")` 向同一导轨追加子行。
- **边框面板**：`ctx.log.box` 提供完全同构的 `step` / `info` / `success` / `warn` / `error` / `debug` 六个方法，渲染与左脊对齐的圆角面板（不支持 Unicode 的终端自动降级为 `+---+`）。

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

## Spinner、Task 与交互式 Prompts

- `ctx.log.task(title, fn)`：在 TTY 下显示动画 Spinner，完成后自动收敛为 `done` 或 `error`（在 CI 或非 TTY 下自动退化为静态 `step` / `done` 日志，不污染日志流）。
- `ctx.log.spinner()`：提供手动 `.start()`、`.message()`、`.stop()`、`.cancel()` 与 `.error()` 控制。
- `prompts`：直接重导出 `@clack/prompts`（`text`、`select`、`confirm`、`multiselect`、`autocomplete`）。

```ts
import { clerc, prompts } from "clerc";

const cli = clerc({ name: "acme", version: "1.0.0" }).command("deploy", {
  async run(ctx) {
    const ok = await prompts.confirm({ message: "确认部署到生产环境？" });
    if (!ok || prompts.isCancel(ok)) {
      return;
    }

    await ctx.log.task("正在上传构建产物...", async (s) => {
      s.message("正在压缩 14 个分块...");

      return "已上传 14 个分块 (420ms)";
    });
  },
});
```
