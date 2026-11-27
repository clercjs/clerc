---
title: Getting Started
---

<script setup>
import scenario from "./getting-started.playground.ts";
</script>

# Getting Started

Clerc is a typed CLI framework for Node.js built around small, composable functions. `--help`, `--version`, `-v`/`-q` verbosity, strict flag checking, typo suggestions, and a structured logger are built into `clerc` out of the box.

## Installation

::: code-group

```sh [pnpm]
pnpm add clerc
```

```sh [npm]
npm install clerc
```

```sh [yarn]
yarn add clerc
```

:::

## Your First CLI

Create `cli.ts`:

```ts
import { Types, cli, command } from "clerc";

const deploy = command("deploy <env> [region]", {
  aliases: "d",
  description: "Deploy service to target environment",
  args: {
    env: {
      type: Types.Enum("staging", "prod"),
      description: "Target environment",
    },
    region: {
      default: "us-east-1",
      description: "Cloud region",
    },
  },
  flags: {
    port: {
      type: Types.Integer({ min: 1, max: 65_535 }),
      short: "p",
      default: 3000,
      env: "PORT",
      description: "Server port",
    },
    dryRun: {
      type: Boolean,
      short: "n",
      description: "Preview without deploying",
    },
  },
  run(ctx) {
    const { env, region } = ctx.args;
    //      ^?
    const { port, dryRun } = ctx.flags;
    //      ^?

    ctx.log.step(`Deploying to ${env} (${region})`, `port=${port}`);
    if (dryRun) {
      ctx.log.box.info("Dry run", "No remote resources were modified.");
    } else {
      ctx.log.success("Deployment complete");
    }
  },
});

const app = cli({
  name: "acme",
  version: "2.0.0",
  description: "Build and deploy TypeScript services",
  commands: [deploy],
});

await app.runMain();
```

Hover over `env`, `region`, `port`, or `dryRun` in the code block above to inspect the exact TypeScript types inferred from your signature and schema.

Run it directly:

<TerminalWindow command="node cli.ts deploy prod -p 8080 -n" :lines='[" {brand:step} {bold:Deploying to prod (us-east-1)}","      {faint:│} {muted:port=8080}"," {cyan:info} {faint:╭─} {bold:Dry run} {faint:───────────────────────────────╮}","      {faint:│}  {muted:No remote resources were modified.}     {faint:│}","      {faint:╰─────────────────────────────────────────╯}"]' />

## Try It Live

<CliPlayground :scenario="scenario" variant="compact" lang="en" />

## `runMain()` vs `run()`

Clerc separates process-level execution from pure invocation:

| Method                         | Behavior                                                                                                           | Best for                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `await app.runMain()`          | Reads `process.argv`, prints diagnostics on failure, and sets `process.exitCode` without calling `process.exit()`. | Your CLI entry file (`bin`).                  |
| `await app.run(argv, options)` | Runs against an explicit `argv` and optional `terminal` without mutating `process.exitCode`.                       | Unit tests, sub-invocations, and MCP servers. |

## Ecosystem Packages

Install only what your CLI needs:

| Package                                                                     | Purpose                                                                                                          |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `clerc`                                                                     | Core combinators (`cli`, `command`, `middleware`, `group`, `use`), POSIX parser, help, diagnostics, and schemas. |
| `@clerc/logger`                                                             | Standalone CLI logger (re-exported by `clerc` as `ctx.log` and `createLogger`).                                  |
| `@clerc/theme`                                                              | Zero-dependency ANSI styling and terminal capability detection (re-exported by `clerc`).                         |
| [`@clerc/plugin-completions`](/official-plugins/plugin-completions)         | Shell completion commands (`completions()`) for Bash, Zsh, Fish, and PowerShell.                                 |
| [`@clerc/plugin-mcp`](/official-plugins/plugin-mcp)                         | Exposes your CLI as a Model Context Protocol stdio server (`mcp()`).                                             |
| [`@clerc/plugin-update-notifier`](/official-plugins/plugin-update-notifier) | Non-blocking background npm update checker middleware (`updateNotifier()`).                                      |
