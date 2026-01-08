---
title: Getting Started
---

# Getting Started

:::warning

Clerc is ESM-only!

:::

## Installation

:::info

The `clerc` package exports a `Cli` function, which is equivalent to `Clerc.create().use(versionPlugin).use(helpPlugin)`. This provides a convenient way to create a CLI with both version and help plugins built-in.

If you need more control, you can use `Clerc.create()` directly and manually add plugins.

Note that the `clerc` package may be larger in size since it re-exports all official plugins. However, if your bundler supports tree-shaking, this shouldn't be an issue. To reduce bundle size, consider installing only `@clerc/core` and the plugins you need.

:::

:::code-group

```sh [npm]
$ npm install clerc
```

```sh [yarn]
$ yarn add clerc
```

```sh [pnpm]
$ pnpm add clerc
```

:::

## Simplest CLI Example

Install clerc, and create a file named `cli.mjs`:

```ts
import { Cli } from "clerc";

Cli() // Create a new CLI with help and version plugins
  .name("foo") // Optional, CLI readable name
  .scriptName("foo") // CLI script name (the command used to run the CLI)
  .description("A foo CLI") // CLI description
  .version("0.0.0") // CLI version
  .command(
    "bar", // Command name
    "A bar command", // Command description
  )
  .on(
    "bar",
    (
      _ctx, // Command context, but we're not using it yet
    ) => {
      console.log("Hello, world from Clerc.js!");
    },
  )
  .parse(); // Parse arguments and run!
```

Then run: `node cli.mjs bar`. It should output in your shell: `Hello, world from Clerc.js!`
