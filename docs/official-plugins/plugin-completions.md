---
title: "@clerc/plugin-completions"
---

<script setup>
import scenario from "./plugin-completions.playground.ts";
</script>

# @clerc/plugin-completions

Zero-dependency static completion script generator and dynamic runtime completion engine for **Zsh**, **Bash**, **Fish**, and **PowerShell**.

<CliPlayground :scenario="scenario" lang="en" />

## Installation

::: code-group

```sh [pnpm]
pnpm add @clerc/plugin-completions
```

```sh [npm]
npm install @clerc/plugin-completions
```

:::

## Usage and Custom `complete()`

Subcommands, aliases, flags, `Types.Enum(...)` values, and built-in `help [command...]` paths complete automatically. Any command, argument, or flag can also provide a synchronous or `async` `complete(ctx)` function:

```ts
import { completionsPlugin } from "@clerc/plugin-completions";
import { Types, clerc } from "clerc";

const cli = clerc({
  name: "acme",
  version: "2.0.0",
}).use(completionsPlugin());

cli.command("deploy <env> [service]", {
  aliases: ["d"],
  description: "Deploy application",
  args: {
    // Enum values ("staging", "prod") complete automatically
    env: Types.Enum("staging", "prod"),
    service: {
      // Async completion using already-typed args and flags
      async complete({ args, flags }) {
        const target = args.env ?? "staging";

        return [
          {
            value: `${target}-api`,
            description: `API in ${flags.region ?? "us-east-1"}`,
          },
          { value: `${target}-web`, description: "Frontend worker" },
        ];
      },
    },
  },
  flags: {
    region: {
      type: String,
      short: "r",
      complete: () => [
        { value: "us-east-1", description: "US East (N. Virginia)" },
        { value: "eu-west-1", description: "Europe (Ireland)" },
      ],
    },
    config: {
      type: String,
      // Delegate to native shell file completion filtered by extension
      complete: () => ({ files: ["ts", "json"] }),
    },
  },
  run() {},
});

await cli.runMain();
```

You can also attach `complete(ctx)` directly on the command options (`cli.command("checkout <branch>", { async complete(ctx) { ... }, run(ctx) {} })`), or set `complete: false` on any command, argument, or flag to exclude it from completions.

## Activating in Your Shell

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

## What Gets Completed

- Multi-level subcommands, namespaces, and command aliases
- Built-in `help [command...]` at arbitrary subcommand depth (`acme help <TAB>`, `acme help db <TAB>`)
- Kebab-case long flags (`--dry-run`), `--no-*` negations, short flags (`-r`), `--flag=value`, and comma-delimited array flags
- `Types.Enum(...)` and Standard JSON Schema `enum` values on flags and arguments
- Custom sync/async `complete(ctx)` handlers and shell path directives (`files: true | "dirs" | ["ext"]`, `noSpace`, `keepOrder`)
