---
title: "@clerc/plugin-update-notifier"
---

# @clerc/plugin-update-notifier

零依赖的后台 npm 更新检查中间件。命令运行期间并发查询最新版本，结果缓存在 `$XDG_CACHE_HOME/clerc-update-notifier`，命令结束后通过 `ctx.log.box.warn` 输出升级提示，不会阻塞短时命令退出。

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

将 `updateNotifier()` 放在 `use: [...]` 首位，使其在命令开始时尽早发起检查，并在内层中间件完成清理后输出提示面板：

```ts
import { updateNotifier } from "@clerc/plugin-update-notifier";
import { cli } from "clerc";

const app = cli({
  name: "acme-cli",
  version: "2.0.0",
  use: [
    updateNotifier({
      // 所有参数均可选，默认直接读取 ctx.model.meta.name 与 ctx.model.meta.version
      checkIntervalMs: 1000 * 60 * 60 * 24, // 24 小时检查一次
      postRunGraceMs: 250,
    }),
  ],
  commands: [
    // ...
  ],
});
```

<TerminalWindow title="命令结束后的 stderr 提示框" :lines='[" {yellow:warn} {faint:╭─} {bold:Update available:} {muted:2.0.0} → {green:2.1.0} {faint:───╮}","      {faint:│}  {muted:Run} {cyan:npm i -g acme-cli} {muted:to update}    {faint:│}","      {faint:╰─────────────────────────────────────╯}"]' />

## `UpdateNotifierOptions` 配置项

| 配置项            | 类型                      | 默认值                         | 说明                                           |
| ----------------- | ------------------------- | ------------------------------ | ---------------------------------------------- |
| `packageName`     | `string`                  | `ctx.model.meta.name`          | 要查询的 npm 包名。                            |
| `version`         | `string`                  | `ctx.model.meta.version`       | 当前版本，用于和远端最新版本比对。             |
| `distTag`         | `string`                  | `"latest"`                     | 查询的 npm dist-tag（如 `"next"`、`"beta"`）。 |
| `checkIntervalMs` | `number`                  | `86_400_000`（24 小时）        | 两次网络检查之间的最小间隔毫秒数。             |
| `registryUrl`     | `string`                  | `"https://registry.npmjs.org"` | 自定义 npm registry 根地址。                   |
| `installCommand`  | `string`                  | `` `npm i -g ${name}` ``       | 更新提示框中展示的升级命令。                   |
| `timeoutMs`       | `number`                  | `1500`                         | registry 请求超时毫秒数。                      |
| `postRunGraceMs`  | `number`                  | `250`                          | 命令结束后最多等待的毫秒数，超时直接跳过提示。 |
| `cacheDir`        | `string`                  | `$XDG_CACHE_HOME` / `~/.cache` | 覆盖检查时间戳的缓存目录。                     |
| `fetch`           | `typeof globalThis.fetch` | `globalThis.fetch`             | 自定义 `fetch` 实现（方便测试或走代理）。      |

## 默认行为

- 在 CI 环境（存在 `CI` 环境变量）、设置了 `NO_UPDATE_NOTIFIER` 或非交互终端（`!ctx.terminal.isTTY`）下自动跳过。
- 用户传入 `-q, --quiet` 时自动静默。
- 进入命令时立即发起检查，并在 `finally` 阶段等待内层中间件清理完毕后再打印提示框。
- `postRunGraceMs`（默认 `250ms`）使用 `unref()` 定时器，网络较慢时也不会拖延命令退出。
