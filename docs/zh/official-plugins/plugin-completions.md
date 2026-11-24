---
title: "@clerc/plugin-completions"
---

# `@clerc/plugin-completions`

基于 [`@bomb.sh/tab`](https://github.com/bombshell-dev/tab)，为 CLI 提供 **Zsh**、**Bash**、**Fish** 与 **PowerShell** 的补全脚本生成与动态运行时补全。

## 安装

::: code-group

```sh [pnpm]
pnpm add @clerc/plugin-completions
```

```sh [npm]
npm install @clerc/plugin-completions
```

:::

## 用法

```ts
import { completionsPlugin } from "@clerc/plugin-completions";
import { Types, clerc } from "clerc";

const cli = clerc({
  name: "acme",
  version: "2.0.0",
}).use(completionsPlugin());

cli.command("deploy <env>", {
  aliases: ["d"],
  description: "部署应用",
  args: {
    // Types.Enum 的枚举值会自动生成补全候选！
    env: Types.Enum("staging", "prod"),
  },
  flags: {
    region: {
      type: String,
      short: "r",
      meta: {
        completions: {
          handler(complete) {
            complete("us-east-1", "US East (N. Virginia)");
            complete("eu-west-1", "Europe (Ireland)");
            complete("ap-northeast-1", "Asia Pacific (Tokyo)");
          },
        },
      },
    },
  },
  run() {},
});

await cli.runMain();
```

## 在 Shell 中启用

::: code-group

```sh [Zsh]
eval "$(acme completions zsh)"
```

```sh [Bash]
eval "$(acme completions bash)"
```

```fish [Fish]
acme completions fish | source
```

```powershell [PowerShell]
acme completions powershell | Out-String | Invoke-Expression
```

:::

## 自动补全范围

- 所有多级子命令、命名空间与命令别名
- 短横线长选项（`--dry-run`）、选项别名与短选项（`-r`）
- `Types.Enum(...)` 及 Standard JSON Schema 中的 `enum` 枚举候选值
- 命令、选项、参数上通过 `meta.completions.handler` 注册的动态异步/同步补全函数（设置 `meta: { completions: { show: false } }` 可隐藏特定项）
