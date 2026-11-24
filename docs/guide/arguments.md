---
title: Arguments
---

<script setup>
import scenario from "./arguments.playground.ts";
</script>

# Positional Arguments

Positional arguments are declared directly in the command signature string using angle brackets `<required>` and square brackets `[optional]`.

<CliPlayground :scenario="scenario" lang="en" />

## Signature Syntax

| Token           | Meaning                       | Inferred `ctx.args` type (default `String`) |
| --------------- | ----------------------------- | ------------------------------------------- |
| `<env>`         | Required single argument      | `string`                                    |
| `[region]`      | Optional single argument      | `string \| undefined`                       |
| `<files...>`    | Required variadic (1 or more) | `string[]`                                  |
| `[files...]`    | Optional variadic (0 or more) | `string[]`                                  |
| `-- [extra...]` | Arguments captured after `--` | `string[]`                                  |

Kebab-case argument names are automatically converted to camelCase keys on `ctx.args` (for example, `<out-dir>` becomes `ctx.args.outDir`).

```ts
import { Types, clerc } from "clerc";

const cli = clerc({ name: "cp-lite", version: "1.0.0" });

cli.command("copy <source-path> [dest-path] [extra-files...]", {
  args: {
    sourcePath: { description: "Source file" },
    destPath: { default: "./dist", description: "Destination directory" },
    extraFiles: { description: "Additional files to copy" },
  },
  run(ctx) {
    ctx.args;
    //  ^?
  },
});
```

::: tip Compile-time key checking
The keys inside `args: { ... }` are constrained to the exact argument names extracted from your command signature. Mistyping `sourcePth` produces an immediate TypeScript error.
:::

## Defaults and Environment Fallbacks

Optional arguments support `default` values (or factory functions). Both required and optional arguments support `env` fallbacks:

```ts
cli.command("deploy <token> [region]", {
  args: {
    token: {
      env: "DEPLOY_TOKEN",
      description: "API token (or set DEPLOY_TOKEN)",
    },
    region: {
      default: "us-east-1",
      description: "Target region",
    },
  },
  run(ctx) {
    // If DEPLOY_TOKEN="sec_123" is set in env:
    // $ acme deploy -> ctx.args.token === "sec_123", ctx.args.region === "us-east-1"
    ctx.args.token;
    //       ^?
    ctx.args.region;
    //       ^?
  },
});
```

When a required argument with `env` is missing from both `argv` and `process.env`, Clerc appends a hint:

<TerminalWindow command="acme deploy" :lines='["{red:error} missing required argument &#39;&lt;token&gt;&#39;","","  {tip:tip} provide &#39;&lt;token&gt;&#39; or set DEPLOY_TOKEN","","      {muted:For more information, try &#39;acme deploy --help&#39;.}"]' />

## Double-Dash (`--`) Arguments

POSIX `--` stops flag parsing. Clerc handles `--` in three ways depending on your signature:

1. **Named arguments after `--`** (`"test [filter] -- [vitest-args...]"`): tokens before `--` bind to `filter`, and tokens after `--` bind to `ctx.args.vitestArgs` (with full schema conversion and `--help` documentation).
2. **Bare `--` in signature** (`"run <script> --"`): tokens before `--` bind to `<script>`, and tokens after `--` are left untouched in `ctx.raw.doubleDash`.
3. **No `--` in signature** (`"rm <file>"`): passing `acme rm -- -weird-name.txt` treats `-weird-name.txt` as the positional `<file>` argument per POSIX convention.

```ts
cli.command("run <script> -- [pass-through...]", {
  run(ctx) {
    // $ acme run build -- --watch --port 4000
    ctx.args.script; // "build"
    ctx.args.passThrough; // ["--watch", "--port", "4000"]
    ctx.raw.doubleDash; // ["--watch", "--port", "4000"]
  },
});
```
