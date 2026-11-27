---
title: "@clerc/plugin-completions"
---

<script setup>
import { dynamicCompletions, shellScripts } from "./plugin-completions.playground.ts";
</script>

# @clerc/plugin-completions

Zero-dependency static completion script generator and dynamic runtime completion engine for **Zsh**, **Bash**, **Fish**, and **PowerShell**.

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

Pass `completions()` directly inside `commands: [...]` (`commands` flattens nested arrays automatically, so no `...` spread is needed). Subcommands, aliases, flags, `Types.Enum(...)` values, static `complete` declarations, and built-in `help [command...]` paths compile directly into the generated shell script. Any command, argument, or flag can also provide a sync or `async` `complete(ctx)` function that invokes `<cli> complete -- ...` only when completing that slot:

```ts
import { completions } from "@clerc/plugin-completions";
import { Complete, Types, cli, command } from "clerc";

const deploy = command("deploy <env> [service]", {
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
      complete: [
        { value: "us-east-1", description: "US East (N. Virginia)" },
        { value: "eu-west-1", description: "Europe (Ireland)" },
      ],
    },
    config: {
      type: String,
      complete: Complete.file("ts", "json"),
    },
  },
  run() {},
});

const app = cli({
  name: "acme",
  version: "2.0.0",
  commands: [deploy, completions()],
});

await app.runMain();
```

You can also attach `complete(ctx)` directly on command options (`command("checkout <branch>", { async complete(ctx) { ... }, run(ctx) {} })`), or set `complete: false` on any command, argument, or flag to exclude it from completions.

<CliPlayground :scenario="dynamicCompletions" lang="en" />

## Activating in Your Shell

Install completions for your current shell (or pass `zsh`, `bash`, `fish`, or `powershell` explicitly):

```sh
acme completions install
acme completions install zsh --dry-run
acme completions uninstall
```

Or load the generated script directly:

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

<CliPlayground :scenario="shellScripts" lang="en" />

## What Gets Completed

- Multi-level subcommands, namespaces, and command aliases
- Built-in `help [command...]` at arbitrary subcommand depth (`acme help <TAB>`, `acme help db <TAB>`)
- Kebab-case long flags (`--dry-run`), `--no-*` negations, short flags (`-r`), `--flag=value`, and comma-delimited array flags
- `Types.Enum(...)` and Standard JSON Schema `enum` values on flags and arguments
- `Complete` helpers (`Complete.file(...extensions)`, `Complete.dir()`, `Complete.list(items, { keepOrder, noSpace, allowFiles })`, `Complete.none`) and sync/async `complete(ctx)` handlers
