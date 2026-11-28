---
title: "@clerc/plugin-completions"
---

# @clerc/plugin-completions

零依赖的 **Zsh**、**Bash**、**Fish** 和 **PowerShell** 自动补全组件，支持静态脚本生成与异步动态补全。

::: tip 事实上……
整个文档站里交互终端按 `Tab` 弹出的补全菜单，其实就是这个包自己的 `resolveCompletions()` 算出来的 - 去下面的交互式 playground 里试试看
:::

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

将 `completions()` 直接放入 `commands: [...]` 即可（`commands` 会自动拍平嵌套数组，无需展开 `...`）。子命令、别名、选项、`Types.Enum(...)`、静态 `complete` 声明以及内置 `help [command...]` 会直接编译进生成的 Shell 脚本；命令、参数或选项也可以提供同步或 `async` 的 `complete(ctx)` 函数，仅在补全该位置时回调 `<cli> complete -- ...`：

```ts
import { completions } from "@clerc/plugin-completions";
import { Complete, Types, cli, command } from "clerc";

const deploy = command("deploy <env> [service]", {
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

const app = cli({
  name: "acme",
  version: "2.0.0",
  commands: [deploy, completions()],
});

await app.runMain();
```

你也可以直接在命令顶层声明 `complete(ctx)`（如 `command("checkout <branch>", { async complete(ctx) { ... }, run(ctx) {} })`），或在任意命令、参数、选项上设置 `complete: false` 将其从补全列表中隐藏。

<CliPlayground demo="plugin-completions/dynamicCompletions" />

## `Complete` 辅助器与插件配置

直接从 `"clerc"` 导入 `Complete`，以声明式写法指定常见补全策略：

| 辅助器                           | 行为说明                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------- |
| `Complete.file(...extensions)`   | 触发 Shell 文件路径补全（可按扩展名过滤，如 `Complete.file("ts", "json")`）。 |
| `Complete.dir()`                 | 仅补全目录路径。                                                              |
| `Complete.list(items, options?)` | 静态候选列表，支持 `{ allowFiles?, noSpace?, keepOrder? }` 控制指令。         |
| `Complete.none`                  | 等价于 `false`，禁用该位置的补全提示与文件回退。                              |

`completions(options?)` 配置项：

| 配置项       | 类型     | 默认值            | 说明                                                      |
| ------------ | -------- | ----------------- | --------------------------------------------------------- |
| `executable` | `string` | `model.meta.name` | 生成的 Shell 脚本在触发动态补全时实际回调的可执行程序名。 |

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

<CliPlayground demo="plugin-completions/shellScripts" />

## 补全能力与编程式 API

- 所有多级子命令、命名空间与前缀匹配的命令别名
- 内置 `help [command...]` 任意层级可用命令补全（如 `acme help <TAB>`、`acme help db <TAB>`）
- 短横线长选项（`--dry-run`）、`--no-*` 取反选项、短选项（`-r`）、`--flag=value` 以及带分隔符的数组选项
- 约束联动过滤：`exclusive` 与 `oneOf` 会在伙伴选项已出现时自动隐藏冲突选项
- `Types.Enum(...)` 及 Standard JSON Schema 中的 `enum` 候选值
- `@clerc/plugin-completions` 同时导出编程式 API：`renderCompletionScript`、`resolveCompletions`、`formatCompletionOutput`、`installCompletions`、`uninstallCompletions`、`resolveInstallPlan`、`detectShell`、`SUPPORTED_SHELLS` 与 `ShellCompDirective`
