---
title: "@clerc/plugin-completions"
---

# @clerc/plugin-completions

Zero-dependency static completion script generator and dynamic runtime completion engine for **Zsh**, **Bash**, **Fish**, and **PowerShell**.

::: tip Fun fact...
Every `Tab` completion menu inside this site's interactive playgrounds is powered directly by this package's own `resolveCompletions()`. Go ahead and hit `Tab` below.
:::

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

<CliPlayground demo="plugin-completions/dynamicCompletions" />

## `Complete` Helpers and Options

Use `Complete` (exported from `"clerc"`) for declarative completion directives without writing custom callbacks:

| Helper                           | Behavior                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `Complete.file(...extensions)`   | Shell file completion (optionally filtered by extensions, e.g. `Complete.file("ts", "json")`). |
| `Complete.dir()`                 | Shell directory-only completion.                                                               |
| `Complete.list(items, options?)` | Static candidate list with optional `{ allowFiles?, noSpace?, keepOrder? }`.                   |
| `Complete.none`                  | Equivalent to `false`; suppresses completion suggestions and file fallback.                    |

`completions(options?)` accepts:

| Option       | Type     | Default           | Description                                                                        |
| ------------ | -------- | ----------------- | ---------------------------------------------------------------------------------- |
| `executable` | `string` | `model.meta.name` | Binary command invoked by the generated shell script when resolving dynamic slots. |

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

<CliPlayground demo="plugin-completions/shellScripts" />

## What Gets Completed and Programmatic API

- Multi-level subcommands, namespaces, and command aliases
- Built-in `help [command...]` at arbitrary subcommand depth (`acme help <TAB>`, `acme help db <TAB>`)
- Kebab-case long flags (`--dry-run`), `--no-*` negations, short flags (`-r`), `--flag=value`, and comma-delimited array flags
- Constraint-aware filtering: `exclusive` and `oneOf` automatically hide conflicting flags once a partner is already present
- `Types.Enum(...)` and Standard JSON Schema `enum` values on flags and arguments
- Programmatic helpers exported from `@clerc/plugin-completions`: `renderCompletionScript`, `resolveCompletions`, `formatCompletionOutput`, `installCompletions`, `uninstallCompletions`, `resolveInstallPlan`, `detectShell`, `SUPPORTED_SHELLS`, and `ShellCompDirective`
