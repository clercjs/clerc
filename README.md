# Clerc: The full-featured cli library.

![clerc](https://socialify.git.ci/clercjs/clerc/image?description=1&font=Source%20Code%20Pro&forks=1&issues=1&logo=https%3A%2F%2Fclerc.js.org%2Flogo.png&owner=1&pattern=Floating%20Cogs&pulls=1&stargazers=1&theme=Dark)

[![Version](https://img.shields.io/npm/v/clerc.svg)](https://npmjs.org/package/clerc)
[![CI](https://github.com/clercjs/clerc/actions/workflows/ci.yml/badge.svg)](https://github.com/clercjs/clerc/actions/workflows/ci.yml)
[![Downloads/week](https://img.shields.io/npm/dw/clerc.svg)](https://npmjs.org/package/clerc)
[![License](https://img.shields.io/npm/l/clerc.svg)](https://github.com/clercjs/clerc/blob/main/package.json)

<!-- toc -->

- [🗒 Description](#-description)
- [✨ Features](#-features)
<!-- tocstop -->

# 🗒 Description

Clerc is a full/featured library (tool set) for building CLI Apps in Node.js, Deno or Bun. 

# ✨ Features

- **Lightweight** - Dependencies are bundled and minified
- **Plugin system** - Add rich features on demand.
- **Chainable APIs** - Composable.
- **Developer friendly** - Strongly typed, converts flags and parameters to camelCase.
- **Parses parameters** - No need to read them by yourself.
- **I18N** - Easy to change different locales.

# 📖 Documentation

Please see https://clerc.js.org.

# 🤔 More...

## Why using Clerc?

Clerc uses [`type-flag`](https://github.com/privatenumber/type-flag) to parse arguments. It is strongly-typed, which brings you better DX. It is powerful(supports custom type) and quite small!

And clerc uses [`lite-emit`](https://github.com/so1ve/lite-emit) to emit events. It is a event emitter library but with better type support.

The whole bundled and minified `@clerc/core` package is only 10KB (ignored types), which is much smaller than yargs, commander, CAC and oclif :)

## Why naming "Clerc"?

Hiroki Osame's [`cleye`](https://github.com/privatenumber/cleye) is an awesome tool for building CLI apps. Its name sounds quite nice, so I also found an English name `Clerc` for this package =)

## 📝 License

[MIT](./LICENSE). Made with ❤️ by [Ray](https://github.com/so1ve)
