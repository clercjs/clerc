---
title: 类型与 Schema
---

# 类型与 Schema

Clerc 中的选项与位置参数共用同一套类型描述管线。你可以使用原生构造函数、内置 `Types.*`、自定义解析函数，或者直接传入任意 **[Standard Schema v1](https://standardschema.dev)** 校验器（Zod、Valibot、ArkType）。

同一份 Schema 会自动驱动五处能力：

1. **运行期校验与类型转换**（支持同步与异步）
2. **`ctx.args` 与 `ctx.flags` 的 TypeScript 输出类型推导**
3. **`--help` 中的占位标签**（如 `<staging|prod>`、`<1..65535>`）
4. **Shell 自动补全候选值**（枚举值在 `@clerc/plugin-completions` 中自动补全）
5. **MCP 工具的 `inputSchema`**（在 `@clerc/plugin-mcp` 中通过 Standard JSON Schema v1 导出）

<CliPlayground preset="types" lang="zh" />

## 直接使用 Zod / Valibot / ArkType

无需任何适配层，直接将 Schema 传给 `type`：

::: code-group

```ts [Zod v4] no-twoslash
import { clerc } from "clerc";
import { z } from "zod";

const cli = clerc({ name: "acme", version: "1.0.0" });

cli.command("invite <email>", {
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
import { clerc } from "clerc";
import * as v from "valibot";

const cli = clerc({ name: "acme", version: "1.0.0" });

cli.command("invite <email>", {
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
import { clerc } from "clerc";

const cli = clerc({ name: "acme", version: "1.0.0" });

cli.command("invite <email>", {
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

## 内置零依赖 `Types`

不想引入外部校验库时，`clerc` 内置了五个常用 Standard Schema 构造器：

```ts
import { Types, clerc } from "clerc";

const cli = clerc({ name: "acme", version: "1.0.0" });

cli.command("release <channel>", {
  args: {
    channel: Types.Enum("alpha", "beta", "rc", "stable"),
  },
  flags: {
    port: { type: Types.Range(1, 65_535), default: 3000 },
    workers: { type: Types.Integer, default: 4 },
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

## 自定义解析函数

任意形如 `(raw: string) => T` 的函数都可作为类型使用。校验失败时直接 `throw new Error(...)` 即可转为标准 `ValidationError`；挂载可选的 `.display` 属性可自定义 `--help` 中的类型占位名：

```ts
import type { TypeFunction } from "clerc";
import { clerc } from "clerc";

const parseKeyValue: TypeFunction<[string, string]> = (raw) => {
  const eq = raw.indexOf("=");
  if (eq <= 0) {
    throw new Error("expected KEY=VALUE format");
  }

  return [raw.slice(0, eq), raw.slice(eq + 1)];
};
parseKeyValue.display = "KEY=VALUE";

const cli = clerc({ name: "acme", version: "1.0.0" }).command("env", {
  flags: {
    define: { type: parseKeyValue, multiple: true, short: "D" },
  },
  run(ctx) {
    ctx.flags.define;
    //        ^?
  },
});
```
