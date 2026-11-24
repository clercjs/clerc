---
title: 进度与交互
---

<script setup>
import {
  interactivePrompts,
  manualSpinner,
  taskSpinner,
} from "../../guide/prompts.playground.ts";
</script>

# 进度与交互

`ctx.log` 内置了任务进度 Spinner，同时 `clerc` 直接重导出了 `@clack/prompts`（`prompts`），用于构建交互式命令行问答。

## 任务进度（`ctx.log.task`）

`ctx.log.task(title, fn)` 在 TTY 终端显示动画 Spinner，支持通过 `s.message(...)` 更新阶段说明，成功时自动输出 `done`；失败时清理 Spinner 并重新抛出错误，交给 Clerc 统一渲染一次（如需额外输出任务级失败文案，可传 `{ errorMessage }`）。在 CI 或非 TTY 环境下会自动降级为普通文本日志。

```ts
import { clerc } from "clerc";

const cli = clerc({ name: "acme", version: "1.0.0" }).command("upload", {
  async run(ctx) {
    await ctx.log.task("正在上传构建产物...", async (s) => {
      s.message("正在压缩 14 个分块...");

      return "已上传 14 个分块 (420ms)";
    });
  },
});
```

<CliPlayground :scenario="taskSpinner" lang="zh" />

## 手动控制 Spinner（`ctx.log.spinner`）

需要手动管理起止状态时，可使用 `ctx.log.spinner()`，提供 `.start()`、`.message()`、`.stop()`、`.cancel()` 和 `.error()` 方法：

```ts
const s = ctx.log.spinner();
s.start("正在连接集群...");
s.message("校验凭证...");
s.stop("已连接");
```

<CliPlayground :scenario="manualSpinner" lang="zh" />

## 交互式提问（`prompts`）

`prompts` 直接重导出了 `@clack/prompts`（包含 `text`、`select`、`confirm`、`multiselect`、`autocomplete`、`isCancel` 等），无需单独安装：

```ts
import { clerc, prompts } from "clerc";

const cli = clerc({ name: "acme", version: "1.0.0" }).command("deploy", {
  async run(ctx) {
    const ok = await prompts.confirm({ message: "确认部署到生产环境？" });
    if (!ok || prompts.isCancel(ok)) {
      return;
    }

    await ctx.log.task("正在部署...", async () => "已发布至生产环境");
  },
});
```

<CliPlayground :scenario="interactivePrompts" lang="zh" />
