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
- **Lightweight** - Dependencies are bundled and minified
- **Plugin system** - Add rich features on demand.
- **Chainable APIs** - Composable.
- **Developer friendly** - Strongly typed, converts flags to camelCase.
- **Parses parameters** - No need to read them by yourself.
- **Official Plugins**
  - Auto-generated help text (via [@clerc/plugin-help](./packages/plugin-help/))
  - Shell completions (via [@clerc/plugin-completions](./packages/plugin-completions/))
  - Not found info (via [@clerc/plugin-not-found](./packages/plugin-not-found/))
  - Friendly error output (via [@clerc/plugin-friendly-error](./packages/plugin-friendly-error/))
  - Strict flags checking (via [@clerc/plugin-strict-flags](./packages/plugin-strict-flags/))
  - Version (via [@clerc/plugin-version](./packages/plugin-version/))
  - Powerful toolkit (via [@clerc/toolkit](./packages/toolkit/) - Just a re-export of many useful libraries)

# 📖 Documentation

- [Getting Started](./docs/getting-started.md)

## 📝 License

[MIT](./LICENSE). Made with ❤️ by [Ray](https://github.com/so1ve)