---
title: 约束
---

# 约束

在 `flags` 中直接通过 `oneOf`、`exclusive`、`together`、`atLeastOne` 组合声明选项约束，并用 `check` 编写跨字段取值校验。同一份定义会同时驱动 **TypeScript 可辨识联合类型收窄**、运行期校验、`--help` 标签、Shell 补全过滤和 MCP JSON Schema 导出。

## 选项约束组合子

将约束组合子直接传给 `flags`（或放在数组 `[...]` 中与普通选项对象、`group()` 自由组合）：

```ts
import { Types, command, exclusive, group, oneOf, together } from "clerc";

const serve = command("serve <env>", {
  args: { env: Types.Enum("staging", "prod") },
  flags: [
    oneOf(
      { token: { type: String, required: true, env: "ACME_TOKEN" } },
      { tokenFile: { type: String, required: true, env: "ACME_TOKEN_FILE" } },
    ),
    exclusive({ json: Boolean }, { yaml: Boolean }),
    group(
      "TLS Options",
      together({
        tlsKey: { type: String, required: true },
        tlsCert: { type: String, required: true },
      }),
    ),
  ],
  run(ctx) {
    // oneOf 会在 token 为 undefined 时将 tokenFile 自动收窄为 string
    const auth = ctx.flags.token ?? ctx.flags.tokenFile;
    //    ^?

    // together 会在判断 tlsCert 后将同组的 tlsKey 自动收窄为 string
    if (ctx.flags.tlsCert) {
      ctx.flags.tlsKey;
      //        ^?
    }
  },
});
```

| 组合子                             | 运行期语义                         | TypeScript 类型收窄                      |
| ---------------------------------- | ---------------------------------- | ---------------------------------------- |
| `oneOf(branch1, branch2, ...)`     | 必须且只能激活其中一个分支。       | 各分支构成的可辨识联合类型。             |
| `exclusive(branch1, branch2, ...)` | 至多激活一个分支（也可全不传）。   | 各激活分支与全未传分支的可辨识联合类型。 |
| `together(flags)`                  | 组内选项必须同时提供，或全部不传。 | “全部存在”与“全部未传”的联合类型。       |
| `atLeastOne(flags)`                | 组内至少需要提供一个选项。         | 常规选项推导类型。                       |

所有组合子末尾均可附带可选的 `{ message, hints }` 配置对象，用于自定义报错文案与提示。

<CliPlayground demo="constraints/flagConstraints" />

## 跨字段检查（`check`）

涉及具体取值或同时横跨 `args` 与 `flags` 的业务规则，可在 `command()`、`middleware()` 或 `cli()` 上配置 `check`（支持单个函数或函数数组）。校验函数接收 `{ args, flags, provided, terminal }`，返回错误提示字符串、结构化的 `{ message, detail?, hints? }` 对象，或返回 `undefined` 表示通过：

```ts
import { cli, command, exclusive } from "clerc";

const listen = command("listen", {
  flags: {
    port: {
      type: Number,
      short: "p",
      default: 3000,
      description: "监听端口（小于 1024 需要 --sudo）",
    },
    sudo: {
      type: Boolean,
      description: "允许绑定特权端口",
    },
  },
  check({ flags }) {
    if (flags.port < 1024 && !flags.sudo) {
      return {
        message: "ports below 1024 require '--sudo'",
        hints: ["pass '--sudo' or choose a port >= 1024"],
      };
    }
  },
  run({ flags, log }) {
    log.success(`Listening on port ${flags.port}`);
  },
});

const app = cli({
  name: "acme",
  version: "2.0.0",
  flags: exclusive({ json: Boolean }, { yaml: Boolean }),
  commands: [listen],
});
```

<CliPlayground demo="constraints/customChecks" />

## 执行时机与生态联动

约束与 `check` 在参数/选项解析、环境变量回退、必填检查及类型转换**之后**，middleware 与 `run()` **之前**执行：

- **`--help` 与 `--version` 优先短路**：不会被 `oneOf` 或 `atLeastOne` 阻断。
- **结构化报错**：校验失败抛出 `ConstraintError`（`code: "ERR_CONSTRAINT"`，退出码 `2`），自动附带关联环境变量提示与当前命令的 `usage` 行。
- **`--help` 展示**：约束组合子会自动内联渲染为选项标签（如 `[conflicts: --yaml]`、`[with: --tls-cert]`）或分组标题注解（如 `TLS OPTIONS  [together]`）。
- **`@clerc/plugin-completions`**：`exclusive` 与 `oneOf` 会在伙伴选项出现后自动隐藏互斥选项。
- **`@clerc/plugin-mcp`**：约束组合子会自动导出为 JSON Schema 的 `dependentRequired` 与 `allOf` 约束。
