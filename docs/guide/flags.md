---
title: Flags
---

<script setup>
import { arraysAndCounters, implicitValue } from "./flags.playground.ts";
</script>

# Flags

Flags configure commands via `--long` options, `-s` short aliases, or environment variables. Define camelCase keys in `flags` and Clerc automatically accepts both `--kebab-case` and `--camelCase` on the command line.

## Shorthand vs Full Definition

When a flag only needs a type, pass the constructor or schema directly. Use an options object when adding metadata, defaults, `required`, or array bounds:

```ts
import { Types, command } from "clerc";

const serve = command("serve", {
  flags: {
    open: Boolean, // shorthand: boolean (defaults to false)
    host: String, // shorthand: string | undefined
    token: {
      type: String,
      required: true, // inferred as `string` (never undefined)
      env: "ACME_TOKEN",
      placeholder: "<secret>",
      description: "API authentication token",
    },
    port: {
      type: Types.Integer({ min: 1, max: 65_535 }),
      short: "p",
      aliases: ["listen"],
      default: 3000,
      env: "PORT",
      description: "Port to listen on",
    },
  },
  run(ctx) {
    ctx.flags;
    //  ^?
  },
});
```

## Supported CLI Syntax

Clerc's built-in POSIX argv parser supports all standard flag conventions:

- **Long flags**: `--port 8080` or `--port=8080`
- **Short flags**: `-p 8080`, `-p=8080`, or attached `-p8080`
- **Bundled short flags**: `-vrn` expands to `-v -r -n`; `-vo dist` sets `-v` and passes `dist` to `-o`
- **Boolean negation**: `Boolean` flags are negatable by default (`--no-cache` sets `cache: false`, and `--help` automatically shows `--cache, --no-cache` when `default: true`). Set `negatable: false` to disable.
- **Explicit boolean literals**: `--cache=false`, `--cache=0`, `--cache=true`, `--cache=1`

## Repeatable Arrays, Delimiters, and Counters

Set `multiple: true` to collect repeatable occurrences into an array (with optional `delimiter`, `unique`, `minItems`, and `maxItems`), or use `Types.Counter` to count repeated short/long flags:

```ts
import { Types, command } from "clerc";

const build = command("build", {
  flags: {
    // Repeatable array with comma delimiter and bounds: -t a,b -t c -> ["a", "b", "c"]
    tags: {
      type: String,
      multiple: true,
      unique: true,
      minItems: 1,
      maxItems: 5,
      short: "t",
      delimiter: ",",
      description: "Release tags",
    },
    // Counter: Types.Counter counts occurrences: -vvv -> 3 (defaults to 0)
    verbose: {
      type: Types.Counter,
      short: "v",
      description: "Increase verbosity",
    },
  },
  run(ctx) {
    ctx.flags.tags;
    //        ^?
    ctx.flags.verbose;
    //        ^?
  },
});
```

<CliPlayground :scenario="arraysAndCounters" lang="en" />

## Optional-Value Flags (`implicitValue`)

Flags like `node --inspect` or `git log --color` accept an optional `=value`, falling back to `implicitValue` when passed bare and `default` (or `undefined`) when omitted:

```ts
const dev = command("dev", {
  flags: {
    inspect: {
      type: Number,
      short: "I",
      implicitValue: 9229,
      description: "Enable inspector",
    },
  },
  run(ctx) {
    // $ acme dev                -> undefined
    // $ acme dev --inspect      -> 9229
    // $ acme dev --inspect=9230 -> 9230
    ctx.flags.inspect;
    //        ^?
  },
});
```

::: info Why `=` is required for explicit values
To avoid ambiguously swallowing the next positional argument (e.g. `acme dev -I src/index.ts`), pass explicit values attached via `=` (`--inspect=9230` or `-I9230`).
:::

<CliPlayground :scenario="implicitValue" lang="en" />

## Lazy Defaults, Env Parsing, and Visibility

- **Lazy default functions**: Pass `default: () => ...` so dynamic values (or fresh arrays) are computed per run. Attach a `.display` property on the function to customize how `--help` prints `[default: ...]`:
  ```ts
  import type { DefaultValueFunction } from "clerc";
  import { command } from "clerc";

  const defaultCwd: DefaultValueFunction<string> = () => process.cwd();
  defaultCwd.display = "current directory";

  const scan = command("scan", {
    flags: {
      dir: { type: String, default: defaultCwd },
    },
    run() {},
  });
  ```
- **Environment variable parsing (`env`)**:
  - `Boolean` flags parse `true` / `1` / `false` / `0` (case-insensitive).
  - `Types.Counter` parses a non-negative integer (`2` → `2`) or a boolean literal (`true` → `1`, `false` → `0`).
  - `multiple: true` array flags split the env string by `delimiter ?? ","` and trim each item.
  - Required flags satisfied by `env` pass without error; if both argv and `env` are missing, Clerc appends a hint mentioning the variable name.
- **Visibility & deprecation**: Set `hidden: true` to omit a flag from `--help`, completions, and MCP schemas (it still parses when passed), or `deprecated: true | "use --new-flag"` to tag it in `--help` and emit a `stderr` warning when used.

## `FlagOptions` Reference

| Option          | Type                           | Description                                                                                         |
| --------------- | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| `type`          | `SingleType`                   | Required. Constructor (`String`, `Number`, `Boolean`), `Types.*`, parser fn, or Standard Schema v1. |
| `short`         | `string`                       | Single-character short alias (e.g. `"p"` for `-p`).                                                 |
| `aliases`       | `string \| string[]`           | Additional long flag names (e.g. `["out", "outFile"]`).                                             |
| `description`   | `string`                       | Description shown in `--help`, completions, and MCP tool schemas.                                   |
| `placeholder`   | `string`                       | Custom value placeholder in `--help` (defaults to `<type>`).                                        |
| `default`       | `T \| DefaultValueFunction<T>` | Default value or lazy factory (mutually exclusive with `required: true`).                           |
| `implicitValue` | `T \| DefaultValueFunction<T>` | Value used when passed bare without `=value` (single-value flags only).                             |
| `required`      | `boolean`                      | Require the flag via argv or `env` (throws `MissingRequiredFlagError`).                             |
| `env`           | `string`                       | Environment variable fallback name.                                                                 |
| `multiple`      | `boolean`                      | Collect repeated occurrences into an array.                                                         |
| `delimiter`     | `string`                       | Split each array flag value on this string (requires `multiple: true`).                             |
| `unique`        | `boolean`                      | Reject duplicate items on array flags.                                                              |
| `minItems`      | `number`                       | Minimum item count on array flags.                                                                  |
| `maxItems`      | `number`                       | Maximum item count on array flags.                                                                  |
| `negatable`     | `boolean`                      | Enable/disable `--no-<flag>` for `Boolean` flags (default `true`).                                  |
| `group`         | `string`                       | Assign flag to a named `--help` group (alternative to `group(title, ...)`).                         |
| `hidden`        | `boolean`                      | Hide from `--help`, completions, and MCP schemas.                                                   |
| `deprecated`    | `boolean \| string`            | Mark deprecated in `--help` and warn on `stderr` when passed.                                       |
| `complete`      | `CompletionOption`             | Static candidates, `Complete.*` helper, `false`, or dynamic `complete(ctx)`.                        |
| `meta`          | `FlagMeta`                     | Open metadata object (augmentable via `FlagCustomMeta`).                                            |

## Constraints and Shared Flags

- **Constraints & Groups**: `flags` accepts a plain object, `group(title, flags)`, constraint combinators (`oneOf`, `exclusive`, `together`, `atLeastOne`), or an array combining them. See [Constraints](/guide/constraints).
- **Sharing flags across commands**: Define shared flags in a `middleware({ flags: { ... } })` and pass it to `use: [mw]` on commands (for full static typing inside `run(ctx)`) and `use(mw, commands)` or `cli({ use: [mw] })`. If a command defines a local flag with the same name as a middleware or global flag, the local flag's type and behavior take precedence.
