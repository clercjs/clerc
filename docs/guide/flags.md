---
title: Flags
---

<script setup>
import { arraysAndCounters, constraints, implicitValue } from "./flags.playground.ts";
</script>

# Flags

Flags configure commands via `--long` options, `-s` short aliases, or environment variables. Define camelCase keys in `flags` and Clerc automatically accepts both `--kebab-case` and `--camelCase` on the command line.

## Shorthand vs Full Definition

When a flag only needs a type, pass the constructor or schema directly. Use an options object when adding metadata, defaults, or constraints:

```ts
import { Types, clerc } from "clerc";

const cli = clerc({ name: "acme", version: "1.0.0" });

cli.command("serve", {
  flags: {
    open: Boolean, // shorthand: boolean (defaults to false)
    host: String, // shorthand: string | undefined
    port: {
      type: Types.Range(1, 65_535),
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

Set `multiple: true` to collect repeatable occurrences into an array, or use `Types.Counter` to count repeated short/long flags:

```ts
import { Types, clerc } from "clerc";

const cli = clerc({ name: "acme", version: "1.0.0" });

cli.command("build", {
  flags: {
    // Repeatable array with comma delimiter: -t a,b -t c -> ["a", "b", "c"]
    tags: {
      type: String,
      multiple: true,
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
cli.command("dev", {
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

## Constraints: `required`, `conflicts`, and `implies`

Declare relationships between flags in the schema instead of writing manual checks in handlers:

```ts
cli.command("deploy", {
  flags: {
    token: {
      type: String,
      required: true,
      env: "ACME_TOKEN",
    },
    json: {
      type: Boolean,
      conflicts: ["yaml"],
    },
    yaml: {
      type: Boolean,
    },
    tlsKey: {
      type: String,
      implies: ["tlsCert"],
    },
    tlsCert: {
      type: String,
    },
  },
  run(ctx) {
    ctx.flags.token;
    //        ^?
  },
});
```

- `conflicts`: throws `FlagConflictError` if both flags are provided.
- `implies`: throws `FlagImpliesError` if `--tls-key` is passed without `--tls-cert`.
- Unknown or self-referencing flag names inside `conflicts` or `implies` are caught upfront when building the CLI model (`InvalidSchemaError`).

<CliPlayground :scenario="constraints" lang="en" />

## Global Flags vs Command Flags

Register global flags on `cli.flags({ ... })` (or inside a `plugin().flags({ ... })`). Every command receives typed access to both its local `flags` and all global flags. If a command defines a local flag with the same name as a global flag, the local flag's type and behavior take precedence for that command.
