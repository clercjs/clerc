---
title: 约束规则
---

<script setup>
import { customRules, declarativeRules } from "../../guide/rules.playground.ts";
</script>

# 约束规则（Rules）

通过 `rules` 在**选项（flag）**与**位置参数（arg）**之间声明强类型约束。不必在每个命令 `run()` 里手写零散的 `if` 判断，一份声明同时驱动运行时校验、`--help` 帮助文档、Shell 补全过滤和 MCP JSON Schema 导出。

## 声明式原语

在 `rules: ({ exclusive, oneOf, together, flag, arg }) => [...]` 中按需解构原语；选项用 `flag("...")`、位置参数用 `arg("...")` 明确标注，所有键名均在编译期校验：

```ts
import { Types, clerc } from "clerc";

const cli = clerc({ name: "acme", version: "2.0.0" });

cli.command("serve [env]", {
  args: { env: Types.Enum("staging", "prod") },
  flags: {
    all: Boolean,
    json: Boolean,
    yaml: Boolean,
    tlsKey: String,
    tlsCert: String,
  },
  rules: ({ exclusive, together, oneOf, flag, arg }) => [
    exclusive(flag("json"), flag("yaml")), // 至多选一
    together(flag("tlsKey"), flag("tlsCert")), // 必须成对出现
    oneOf(arg("env"), flag("all")), // 位置参数与选项恰好选一
  ],
  run(ctx) {
    // 进入 middleware 和 run() 前已通过全部校验
  },
});
```

| 原语                        | 语义                                         |
| --------------------------- | -------------------------------------------- |
| `exclusive(a, b, ...)`      | 至多只能提供一个目标（互斥）。               |
| `oneOf(a, b, ...)`          | 必须恰好提供一个目标（必选且互斥）。         |
| `atLeastOne(a, b, ...)`     | 至少需要提供一个目标。                       |
| `together(a, b, ...)`       | 所有目标必须同时提供，或全部不提供。         |
| `requires(source, targets)` | 提供了 `source` 时，必须同时提供 `targets`。 |

::: tip 显式标注与编译期安全
直接传裸字符串或拼错选项/参数名都会在编译期报错。在全局 `cli.rules()` 或没有位置参数的命令上，构造器会自动隐藏 `arg`，让编辑器补全只提示合法的选项键名。
:::

<CliPlayground :scenario="declarativeRules" lang="zh" />

## 全局规则与自定义校验函数

通过 `cli.rules(...)` 或 `plugin().rules(...)` 注册对所有非 `standalone` 命令生效的全局约束。涉及具体取值的条件判断，可直接传入同步或 `async` 校验函数，接收已转换类型的 `{ args, flags, provided, terminal }`，返回错误文案（或抛出 `ClercError`）即可中断执行：

```ts
const cli = clerc({ name: "acme", version: "2.0.0" })
  .flags({ json: Boolean, yaml: Boolean })
  .rules(({ exclusive, flag }) => [exclusive(flag("json"), flag("yaml"))])
  .command("listen", {
    flags: {
      port: { type: Number, short: "p", default: 3000 },
      sudo: Boolean,
    },
    rules: () => [
      ({ flags }) => {
        if (flags.port < 1024 && !flags.sudo) {
          return "ports below 1024 require --sudo";
        }
      },
    ],
    run({ flags, log }) {
      log.success(`Listening on port ${flags.port}`);
    },
  });
```

<CliPlayground :scenario="customRules" lang="zh" />

## 执行时机与生态联动

规则在参数/选项解析、环境变量回退、必填检查及类型转换**之后**，middleware 与 `run()` **之前**执行：

- **`--help` 与 `--version` 优先短路**：不会被 `oneOf` 或 `atLeastOne` 阻断。
- **结构化报错**：校验失败抛出 `RuleError`（`code: "ERR_RULE_VIOLATION"`，退出码 `2`），并自动附带当前命令的 `usage` 行。
- **`--help` 展示**：声明式规则会自动渲染在 `CONSTRAINTS` 区块中。
- **`@clerc/plugin-completions`**：`exclusive` 与 `oneOf` 规则会自动隐藏已冲突的选项，并跳过与已传选项冲突的位置参数补全。
- **`@clerc/plugin-mcp`**：声明式规则会自动导出为 JSON Schema 的 `dependentRequired` 与 `allOf` 约束。
