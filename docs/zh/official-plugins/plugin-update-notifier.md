---
title: "@clerc/plugin-update-notifier"
---

# @clerc/plugin-update-notifier

零依赖的后台 npm 更新检查插件。命令运行期间并发查询最新版本，结果缓存在 `$XDG_CACHE_HOME/clerc-update-notifier`，命令结束后通过 `ctx.log.box.warn` 输出升级提示，不会阻塞短时命令退出。

## 安装

::: code-group

```sh [pnpm]
pnpm add @clerc/plugin-update-notifier
```

```sh [npm]
npm install @clerc/plugin-update-notifier
```

:::

## 用法

```ts
import { updateNotifierPlugin } from "@clerc/plugin-update-notifier";
import { clerc } from "clerc";

const cli = clerc({
  name: "acme-cli",
  version: "2.0.0",
}).use(
  updateNotifierPlugin({
    // 所有参数均可选，默认直接读取 ctx.model.meta.name 与 ctx.model.meta.version
    checkIntervalMs: 1000 * 60 * 60 * 24, // 24 小时检查一次
    postRunGraceMs: 250,
  }),
);
```

<TerminalWindow title="命令结束后的 stderr 提示框" :lines='[" {yellow:warn} {faint:╭─} {bold:Update available:} {muted:2.0.0} → {green:2.1.0} {faint:───╮}","      {faint:│}  {muted:Run} {cyan:npm i -g acme-cli} {muted:to update}    {faint:│}","      {faint:╰─────────────────────────────────────╯}"]' />

## 默认行为

- 在 CI 环境（存在 `CI` 环境变量）、设置了 `NO_UPDATE_NOTIFIER` 或非交互终端（`!ctx.terminal.isTTY`）下自动跳过。
- 用户传入 `-q, --quiet` 时自动静默。
- 以 `{ enforce: "pre" }` 在最外层运行：命令开始时立即发起检查，等其他中间件清理完毕后再打印提示框。
- `postRunGraceMs`（默认 `250ms`）使用 `unref()` 定时器，网络较慢时也不会拖延命令退出。
