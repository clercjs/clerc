---
title: Types
---

<script setup>
import { builtinTypes, customParser } from "./types.playground.ts";
</script>

# Types

Every flag and positional argument in Clerc goes through a single type descriptor pipeline. You can use JavaScript constructors, built-in `Types.*`, custom parser functions, or **any [Standard Schema v1](https://standardschema.dev) validator** (Zod, Valibot, ArkType).

One schema automatically drives five places:

1. **Runtime validation and transformation** (sync or async)
2. **TypeScript output type inference** on `ctx.args` and `ctx.flags`
3. **`--help` placeholder labels** (e.g. `<staging|prod>`, `<1..65535>`)
4. **Shell tab-completion candidates** (enum values complete automatically in `@clerc/plugin-completions`)
5. **MCP tool `inputSchema`** (via Standard JSON Schema v1 in `@clerc/plugin-mcp`)

## Standard Schema v1 (Zod, Valibot, ArkType)

Pass any Standard Schema v1 object directly as `type`. No adapter package is needed:

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
  run(ctx) {
    // Fully typed from Valibot's output type
  },
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

Async Standard Schema validators are also supported. Clerc resolves flags and arguments asynchronously before running middleware and handlers.

## Built-in `Types`

When you don't need an external validation library, `clerc` ships zero-dependency Standard Schema v1 helpers under `Types`:

```ts
import { Types, command } from "clerc";

const release = command("release <channel>", {
  args: {
    // Displays <alpha|beta|rc|stable>, auto-completes in shells, exports JSON enum
    channel: Types.Enum("alpha", "beta", "rc", "stable"),
  },
  flags: {
    // Displays <1..65535>, validates inclusive integer bounds
    port: { type: Types.Integer({ min: 1, max: 65_535 }), default: 3000 },
    // Displays >=1, rejects floats like "1.5" or empty strings
    workers: { type: Types.Integer({ min: 1 }), default: 4 },
    // Displays <0..1>, validates floating-point bounds
    ratio: { type: Types.Number({ min: 0, max: 1 }) },
    // Trims whitespace and rejects empty strings
    token: { type: Types.String({ trim: true, nonEmpty: true }) },
    // Displays <v<major>.<minor>> (or regex literal if label omitted)
    tag: { type: Types.Regex(/^v\d+\.\d+$/, "v<major>.<minor>") },
    // Counts occurrences (-vvv -> 3, defaults to 0)
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

<CliPlayground :scenario="builtinTypes" lang="en" />

## Custom Parser Functions

Any function `(raw: string) => T` is a valid type. Throw an `Error` to report a structured `ValidationError`, and attach an optional `.display` string to customize the `<placeholder>` shown in `--help`:

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
    define: {
      type: parseKeyValue,
      multiple: true,
      short: "D",
      description: "Define build constants",
    },
  },
  run(ctx) {
    ctx.flags.define;
    //        ^?
  },
});
```

<CliPlayground :scenario="customParser" lang="en" />
