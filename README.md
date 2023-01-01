Clerc: The full-featured cli framework.
=======================================

[![Version](https://img.shields.io/npm/v/clerc.svg)](https://npmjs.org/package/clerc)
[![CI](https://github.com/so1ve/clerc/actions/workflows/ci.yml/badge.svg)](https://github.com/so1ve/clerc/actions/workflows/ci.yml)
[![Downloads/week](https://img.shields.io/npm/dw/clerc.svg)](https://npmjs.org/package/clerc)
[![License](https://img.shields.io/npm/l/clerc.svg)](https://github.com/so1ve/clerc/blob/main/package.json)

<!-- toc -->
* [🗒 Description](#-description)
<!-- * [🚀 Getting Started Tutorial](#-getting-started-tutorial) -->
* [✨ Features](#-features)
<!-- * [📌 Requirements](#-requirements)
* [📌 Migrating from V1](#-migrating-from-v1)
* [🏗 Usage](#-usage)
* [📚 Examples](#-examples)
* [🔨 Commands](#-commands)
* [🏭 Related Repositories](#-related-repositories)
* [🦔 Learn More](#-learn-more)
* [📣 Feedback](#-feedback) -->
<!-- tocstop -->

# 🗒 Description

Clerc is a framework for building CLI Apps in Node.js or Deno. It's designed both for single-command CLIs, or for very complex CLIs that have subcommands.

# 💎 Features
- Lightweight
- Plugin system
- Chainable APIs
- Strongly typed
- Parses parameters
- Extensible with plugins
- Converts flags to camelCase
- Outputs description and supplied help text when `help` or `--help` (via [@clerc/plugin-help](./packages/plugin-help/))
- Completions (via [@clerc/plugin-completions](./packages/plugin-completions/))
- Not found info (via [@clerc/plugin-not-found](./packages/plugin-not-found/))
- Friendly error output (via [@clerc/plugin-friendly-error](./packages/plugin-friendly-error/))
- Strict flags checking (via [@clerc/plugin-strict-flags](./packages/plugin-strict-flags/))
- Version (via [@clerc/plugin-version](./packages/plugin-version/))
- Powerful toolkit (via [@clerc/toolkit](./packages/toolkit/) - Just a re-export of many useful libraries)

# 📦 Installation

> NOTE: The `clerc` packages exports `@clerc/core`, `@clerc/toolkit` and all plugins, so it may increase your bundle size. To reduce, please install `@clerc/core` and plugins on demand.

```bash
$ npm install clerc -S
$ yarn add clerc
$ pnpm add clerc
```

# 🚀 Usage

```bash
$ node ./foo-cli.mjs foo --bar baz
```

```js
import { Clerc, completionsPlugin, helpPlugin } from "clerc";

const cli = Clerc.create()
  .name("foo-cli")
  .description("A simple cli")
  .version("1.0.0")
  .use(helpPlugin()) // Uses help plugin
  .use(completionsPlugin()) // Uses completions plugin
  .command("foo", "A foo command", {
    parameters: [
      "[param...]",
    ],
    flags: {
      bar: {
        description: "A bar flag",
        type: Boolean,
        default: false,
      },
    },
  })
  .on("foo", (ctx) => {
    console.log(ctx);
    /*
      {
        name: 'foo',
        resolved: true,
        isSingleCommand: false,
        raw: {
          flags: { bar: false },
          unknownFlags: {},
          _: [ 'foo', '--': [] ],
          parameters: [],
          mergedFlags: { bar: false }
        },
        parameters: [Object: null prototype] { param: [] },
        flags: { bar: false },
        unknownFlags: {},
        cli: _Clerc {}
      }
    */
  })
  .parse();
```

## 📝 License

[MIT](./LICENSE). Made with ❤️ by [Ray](https://github.com/so1ve)