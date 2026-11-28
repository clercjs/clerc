---
title: 类型
---

<script setup>
import { builtinTypes, customParser } from "../../guide/types.playground.ts";
</script>

# 类型

Clerc 的选项和位置参数共用同一套类型系统。你可以使用原生构造函数（`String`、`Number`、`Boolean`）、内置 `Types.*`、自定义解析函数，或直接传入任意 **[Standard Schema v1](https://standardschema.dev)** 校验器（Zod、Valibot、ArkType）。

定义一次 Schema，会自动用于以下五个地方：

1. **运行期校验与类型转换**（支持同步与异步）
2. **`ctx.args` 与 `ctx.flags` 的 TypeScript 输出类型推导**
3. **`--help` 中的占位标签**（如 `<staging|prod>`、`<1..65535>`）
4. **Shell 自动补全候选值**（枚举值在 `@clerc/plugin-completions` 中自动补全）
5. **MCP 工具的 `inputSchema`**（在 `@clerc/plugin-mcp` 中通过 Standard JSON Schema v1 导出）

## 直接使用 Zod / Valibot / ArkType

无需任何适配层，直接将 Schema 传给 `type`：

::: code-group

```ts [Zod v4] no-twoslash
import { command } from "clerc";
import { z } from "zod";

const invite = command("invite <email>", {
  args: {
    email: z.email(),
  },
  flags: {
    role: {
      type: z.enum(["member", "admin"]),
      default: "member",
    },
    ttlHours: {
      type: z.coerce.number().int().min(1).max(168),
      default: 24,
    },
  },
  run(ctx) {
    // ctx.args.email     -> string
    // ctx.flags.role     -> "member" | "admin"
    // ctx.flags.ttlHours -> number
  },
});
```

```ts [Valibot] no-twoslash
import { command } from "clerc";
import * as v from "valibot";

const invite = command("invite <email>", {
  args: {
    email: v.pipe(v.string(), v.email()),
  },
  flags: {
    role: {
      type: v.picklist(["member", "admin"]),
      default: "member",
    },
  },
  run(ctx) {},
});
```

```ts [ArkType] no-twoslash
import { type } from "arktype";
import { command } from "clerc";

const invite = command("invite <email>", {
  args: {
    email: type("string.email"),
  },
  flags: {
    role: {
      type: type("'member' | 'admin'"),
      default: "member",
    },
  },
  run(ctx) {},
});
```

:::

同样支持异步 Standard Schema 校验器。当 Schema 导出了 Standard JSON Schema `enum` 候选列表（包含内置 `Types.Enum` 与 Zod v4 `z.enum`）时，输入拼写错误会自动附带相近值提示（`a similar value exists: '...'`）。

## 内置 `Types`

不想引入外部校验库时，`clerc` 内置了零依赖的 Standard Schema v1 构造器：

| 构造器                           | 可选参数                                                           | 推导类型       |
| -------------------------------- | ------------------------------------------------------------------ | -------------- |
| `Types.Enum(...values)`          | 一个或多个字符串字面量                                             | 字面量联合类型 |
| `Types.Integer(options?)`        | `{ min?, max?, display? }`                                         | `number`       |
| `Types.Number(options?)`         | `{ min?, max?, display? }`                                         | `number`       |
| `Types.String(options?)`         | `{ trim?, nonEmpty?, minLength?, maxLength?, pattern?, display? }` | `string`       |
| `Types.Regex(pattern, display?)` | `Types.String({ pattern, display })` 的简写                        | `string`       |
| `Types.Counter`                  | 统计选项重复出现次数（`-vvv` → `3`，默认为 `0`）                   | `number`       |

原生构造函数同样可直接使用：`String` 透传原始字符串，`Number` 解析有效数字（空字符串和 `NaN` 会抛 `ValidationError`），`Boolean` 定义支持 `--no-*` 取反且默认为 `false` 的布尔选项。

```ts
import { Types, command } from "clerc";

const release = command("release <channel>", {
  args: {
    channel: Types.Enum("alpha", "beta", "rc", "stable"),
  },
  flags: {
    port: { type: Types.Integer({ min: 1, max: 65_535 }), default: 3000 },
    workers: { type: Types.Integer({ min: 1 }), default: 4 },
    ratio: { type: Types.Number({ min: 0, max: 1 }) },
    token: {
      type: Types.String({ trim: true, nonEmpty: true, minLength: 4 }),
    },
    tag: { type: Types.Regex(/^v\d+\.\d+$/, "v<major>.<minor>") },
    verbose: { type: Types.Counter, short: "v" },
  },
  run(ctx) {
    ctx.args.channel;
    //       ^?
    ctx.flags.port;
    //        ^?
    ctx.flags.workers;
    //        ^?
  },
});
```

<CliPlayground :scenario="builtinTypes" lang="zh" />

## 自定义解析函数

任意形如 `(raw: string) => T` 的函数都可作为类型使用。校验失败时直接 `throw new Error(...)` 即可转为标准 `ValidationError`；设置可选的 `.display` 属性可以自定义 `--help` 中显示的类型名称：

```ts
import type { TypeFunction } from "clerc";
import { command } from "clerc";

const parseKeyValue: TypeFunction<[string, string]> = (raw) => {
  const eq = raw.indexOf("=");
  if (eq <= 0) {
    throw new Error("expected KEY=VALUE format");
  }

  return [raw.slice(0, eq), raw.slice(eq + 1)];
};
parseKeyValue.display = "KEY=VALUE";

const envCmd = command("env", {
  flags: {
    define: { type: parseKeyValue, multiple: true, short: "D" },
  },
  run(ctx) {
    ctx.flags.define;
    //        ^?
  },
});
```

<CliPlayground :scenario="customParser" lang="zh" />
