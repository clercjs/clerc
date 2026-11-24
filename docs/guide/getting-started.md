---
title: Getting Started
---

# Getting Started

Clerc is an ESM-only CLI framework for **Node.js 24+**. Core features - `--help`, `--version`, `-v`/`-q` verbosity, strict flag checking, typo suggestions, and a structured terminal logger - are built directly into `clerc` with no mandatory plugin setup.

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

## Your First CLI in 30 Seconds

Create `cli.ts`:

```ts
import { Types, clerc } from "clerc";

const cli = clerc({
  name: "acme",
  version: "2.0.0",
  description: "Build and deploy TypeScript services",
});

cli.command("deploy <env> [region]", {
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
      type: Types.Range(1, 65_535),
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

await cli.runMain();
```

Hover over `env`, `region`, `port`, or `dryRun` in the code block above to inspect the exact TypeScript types inferred from your signature and schema.

Run it directly with Node.js 24+ native TypeScript support:

<TerminalWindow command="node cli.ts deploy prod -p 8080 -n" :lines='[" {brand:step} {bold:Deploying to prod (us-east-1)}","      {faint:│} {muted:port=8080}"," {cyan:info} {faint:╭─} {bold:Dry run} {faint:───────────────────────────────╮}","      {faint:│}  {muted:No remote resources were modified.}     {faint:│}","      {faint:╰─────────────────────────────────────────╯}"]' />

## Try It Live

<CliPlayground lang="en" />

## `runMain()` vs `run()`

Clerc separates process-level execution from pure invocation:

| Method                         | Behavior                                                                                                           | Best for                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `await cli.runMain()`          | Reads `process.argv`, prints diagnostics on failure, and sets `process.exitCode` without calling `process.exit()`. | Your CLI entry file (`bin`).                  |
| `await cli.run(argv, options)` | Runs against an explicit `argv` and optional `terminal` without mutating `process.exitCode`.                       | Unit tests, sub-invocations, and MCP servers. |

## Ecosystem Packages

Install only what your CLI needs:

| Package                                                                     | Purpose                                                                                                       |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `clerc`                                                                     | Core CLI router, POSIX argv parser, help & diagnostics, built-in `-v`/`-q` verbosity, and Standard Schema v1. |
| `@clerc/logger`                                                             | Standalone CLI logger (re-exported by `clerc` as `ctx.log` and `createLogger`).                               |
| `@clerc/theme`                                                              | Zero-dependency ANSI styling and terminal capability detection (re-exported by `clerc`).                      |
| [`@clerc/plugin-completions`](/official-plugins/plugin-completions)         | Shell completion scripts and runtime completions for Bash, Zsh, Fish, and PowerShell.                         |
| [`@clerc/plugin-mcp`](/official-plugins/plugin-mcp)                         | Turns your CLI into a Model Context Protocol stdio server (`<cli> mcp`).                                      |
| [`@clerc/plugin-update-notifier`](/official-plugins/plugin-update-notifier) | Non-blocking background npm update checker and banner renderer.                                               |
