---
title: "@clerc/plugin-completions"
---

<script setup>
import { dynamicCompletions, shellScripts } from "../../official-plugins/plugin-completions.playground.ts";
</script>

# @clerc/plugin-completions

零依赖的 **Zsh**、**Bash**、**Fish** 和 **PowerShell** 自动补全插件，支持静态脚本生成与异步动态补全。

## 安装

::: code-group

```sh [pnpm]
pnpm add @clerc/plugin-completions
```

```sh [npm]
npm install @clerc/plugin-completions
```

:::

## 用法与自定义异步 `complete()`

子命令、别名、选项、`Types.Enum(...)`、静态 `complete` 声明以及内置 `help [command...]` 会直接编译进生成的 Shell 脚本；命令、参数或选项也可以提供同步或 `async` 的 `complete(ctx)` 函数，仅在补全该位置时回调 `<cli> complete -- ...`：

```ts
import { completionsPlugin } from "@clerc/plugin-completions";
import { Complete, Types, clerc } from "clerc";

const cli = clerc({
  name: "acme",
  version: "2.0.0",
}).use(completionsPlugin());

cli.command("deploy <env> [service]", {
  aliases: ["d"],
  description: "部署应用",
  args: {
    // Types.Enum 的候选值会自动补全
    env: Types.Enum("staging", "prod"),
    service: {
      // 可读取前序已输入的 args 与已解析的 flags 动态异步返回候选
      async complete({ args, flags }) {
        const target = args.env ?? "staging";

        return [
          {
            value: `${target}-api`,
            description: `API (${flags.region ?? "us-east-1"})`,
          },
          { value: `${target}-web`, description: "前端服务" },
        ];
      },
    },
  },
  flags: {
    region: {
      type: String,
      short: "r",
      complete: [
        { value: "us-east-1", description: "美东 (弗吉尼亚)" },
        { value: "eu-west-1", description: "欧洲 (爱尔兰)" },
      ],
    },
    config: {
      type: String,
      complete: Complete.file("ts", "json"),
    },
  },
  run() {},
});

await cli.runMain();
```

你也可以直接在命令顶层声明 `complete(ctx)`（如 `cli.command("checkout <branch>", { async complete(ctx) { ... }, run(ctx) {} })`），或在任意命令、参数、选项上设置 `complete: false` 将其从补全列表中隐藏。

<CliPlayground :scenario="dynamicCompletions" lang="zh" />

## 在 Shell 中启用

自动检测当前 Shell 并安装补全脚本（也可以显式传入 `zsh`、`bash`、`fish` 或 `powershell`）：

```sh
acme completions install
acme completions install zsh --dry-run
acme completions uninstall
```

或者直接按需加载生成的脚本：

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

<CliPlayground :scenario="shellScripts" lang="zh" />

## 补全能力一览

- 所有多级子命令、命名空间与前缀匹配的命令别名
- 内置 `help [command...]` 任意层级可用命令补全（如 `acme help <TAB>`、`acme help db <TAB>`）
- 短横线长选项（`--dry-run`）、`--no-*` 取反选项、短选项（`-r`）、`--flag=value` 以及带分隔符的数组选项
- `Types.Enum(...)` 及 Standard JSON Schema 中的 `enum` 候选值
- `Complete` 构造器（`Complete.file(...extensions)`、`Complete.dir()`、`Complete.list(items, { keepOrder, noSpace, allowFiles })`、`Complete.none`）以及同步 / `async` 的 `complete(ctx)` 动态补全
