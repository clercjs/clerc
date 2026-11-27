---
title: Flags
---

<script setup>
import { arraysAndCounters, implicitValue } from "./flags.playground.ts";
</script>

# Flags

Flags configure commands via `--long` options, `-s` short aliases, or environment variables. Define camelCase keys in `flags` and Clerc automatically accepts both `--kebab-case` and `--camelCase` on the command line.

## Shorthand vs Full Definition

When a flag only needs a type, pass the constructor or schema directly. Use an options object when adding metadata, defaults, or array bounds:

```ts
import { Types, command } from "clerc";

const serve = command("serve", {
  flags: {
    open: Boolean, // shorthand: boolean (defaults to false)
    host: String, // shorthand: string | undefined
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
    // Repeatable array with comma delimiter: -t a,b -t c -> ["a", "b", "c"]
    tags: {
      type: String,
      multiple: true,
      unique: true,
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

## Constraints and Shared Flags

- **Constraints & Groups**: `flags` accepts a plain object, `group(title, flags)`, constraint combinators (`oneOf`, `exclusive`, `together`, `atLeastOne`), or an array combining them. See [Constraints](/guide/constraints).
- **Sharing flags across commands**: Define shared flags in a `middleware({ flags: { ... } })` and pass it to `use: [mw]` on commands (for full static typing inside `run(ctx)`) and `use(mw, commands)` or `cli({ use: [mw] })`. If a command defines a local flag with the same name as a middleware or global flag, the local flag's type and behavior take precedence.
