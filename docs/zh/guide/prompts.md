---
title: 进度和提示
---

<script setup>
import {
  interactivePrompts,
  manualSpinner,
  taskSpinner,
} from "../../guide/prompts.playground.ts";
</script>

# 进度和提示

`ctx.log` 内置了任务进度 Spinner，同时通过 `clerc/prompts` 子路径重导出了 `@clack/prompts`，用于构建交互式命令行问答。

## 任务进度（`ctx.log.task`）

`ctx.log.task(title, fn)` 在 TTY 终端显示动画 Spinner，支持通过 `s.message(...)` 更新阶段说明，成功时自动输出 `done`；失败时清理 Spinner 并重新抛出错误，交给 Clerc 统一渲染一次（如需额外输出任务级失败文案，可传 `{ errorMessage }`）。在 CI 或非 TTY 环境下会自动降级为普通文本日志。

```ts
import { cli, command } from "clerc";

const upload = command("upload", {
  async run(ctx) {
    await ctx.log.task("正在上传构建产物...", async (s) => {
      s.message("正在压缩 14 个分块...");

      return "已上传 14 个分块 (420ms)";
    });
  },
});

const app = cli({ name: "acme", version: "1.0.0", commands: [upload] });
```

<CliPlayground :scenario="taskSpinner" lang="zh" />

## 手动控制 Spinner（`ctx.log.spinner`）

需要手动管理起止状态时，可使用 `ctx.log.spinner()`，提供 `.start()`、`.message()`、`.stop()`、`.cancel()` 和 `.error()` 方法：

```ts
import type { CommandContext } from "clerc";

declare const ctx: CommandContext;
// ---cut---
const s = ctx.log.spinner();
s.start("正在连接集群...");
s.message("校验凭证...");
s.stop("已连接");
```

<CliPlayground :scenario="manualSpinner" lang="zh" />

## 交互式提问（`prompts`）

`clerc/prompts` 单独重导出了 `@clack/prompts`（包含 `text`、`select`、`confirm`、`multiselect`、`autocomplete`、`password`、`isCancel` 等），无需额外安装，且不会拖慢非交互命令的冷启动。既可在顶层引入，也可在命令 `run()` 中按需 `await import("clerc/prompts")`：

```ts
import { cli, command } from "clerc";
import * as prompts from "clerc/prompts";

const deploy = command("deploy", {
  flags: {
    yes: { type: Boolean, short: "y", description: "跳过交互确认" },
  },
  async run(ctx) {
    if (!ctx.flags.yes) {
      const ok = await prompts.confirm({ message: "确认部署到生产环境？" });
      if (!ok || prompts.isCancel(ok)) {
        return;
      }
    }

    await ctx.log.task("正在部署...", async () => "已发布至生产环境");
  },
});

const app = cli({ name: "acme", version: "1.0.0", commands: [deploy] });
```

<CliPlayground :scenario="interactivePrompts" lang="zh" />

## 非 TTY 自动保护与管道输入

`clerc/prompts` 导出的所有交互式提问函数（`text`、`select`、`confirm`、`multiselect`、`autocomplete`、`password`、`path`、`date`、`multiline`、`selectKey` 等）均内置非 TTY 保护：当 `process.stdin.isTTY` 或 `process.stdout.isTTY` 为 `false` 且未传入自定义 `input`/`output` 流时，会立即抛出清晰错误，避免 CI 或脚本无限卡死。

推荐结合 `--yes` 选项或 `ctx.terminal.isInputTTY` + `ctx.terminal.readStdin()`，让命令同时兼容交互终端与管道脚本：

```ts
import { command } from "clerc";
import * as prompts from "clerc/prompts";

const setSecret = command("set-secret <name>", {
  async run(ctx) {
    const value = ctx.terminal.isInputTTY
      ? await prompts.password({ message: `输入 ${ctx.args.name} 的值:` })
      : (await ctx.terminal.readStdin()).trim();

    if (prompts.isCancel(value)) {
      return;
    }
    ctx.log.success(`已保存 ${ctx.args.name}（${value.length} 字符）`);
  },
});
```
