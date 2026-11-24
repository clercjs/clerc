---
title: "@clerc/plugin-completions"
---

# `@clerc/plugin-completions`

Adds static shell completion script generation and dynamic runtime tab-completion for **Zsh**, **Bash**, **Fish**, and **PowerShell**, powered by [`@bomb.sh/tab`](https://github.com/bombshell-dev/tab).

## Installation

::: code-group

```sh [pnpm]
pnpm add @clerc/plugin-completions
```

```sh [npm]
npm install @clerc/plugin-completions
```

:::

## Usage

```ts
import { completionsPlugin } from "@clerc/plugin-completions";
import { Types, clerc } from "clerc";

const cli = clerc({
  name: "acme",
  version: "2.0.0",
}).use(completionsPlugin());

cli.command("deploy <env>", {
  aliases: ["d"],
  description: "Deploy application",
  args: {
    // Enum values ("staging", "prod") are completed automatically!
    env: Types.Enum("staging", "prod"),
  },
  flags: {
    region: {
      type: String,
      short: "r",
      meta: {
        completions: {
          handler(complete) {
            complete("us-east-1", "US East (N. Virginia)");
            complete("eu-west-1", "Europe (Ireland)");
            complete("ap-northeast-1", "Asia Pacific (Tokyo)");
          },
        },
      },
    },
  },
  run() {},
});

await cli.runMain();
```

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

## What Gets Completed Automatically

- Subcommands, nested namespaces, and command aliases
- Kebab-case long flags (`--dry-run`), flag aliases, and short flags (`-n`)
- `Types.Enum(...)` and Standard JSON Schema `enum` values on both flags and arguments
- Custom dynamic completion handlers via `meta.completions.handler` on commands, flags, and arguments (hide specific items from completion with `meta: { completions: { show: false } }`)
