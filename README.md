![Clerc Card](.github/assets/ClercCard.png)

<p align="center">
	<a target="_blank" href="https://clerc.js.org" noreferrer noopener>Clerc</a> is a full-featured library (tool set) for building CLI Apps in Node.js, Deno or Bun.
</p>

<div align="center">

[![Version](https://img.shields.io/npm/v/clerc.svg)](https://npmjs.org/package/clerc)
[![CI](https://github.com/clercjs/clerc/actions/workflows/ci.yml/badge.svg)](https://github.com/clercjs/clerc/actions/workflows/ci.yml)
[![Downloads/week](https://img.shields.io/npm/dw/clerc.svg)](https://npmjs.org/package/clerc)
[![License](https://img.shields.io/npm/l/clerc.svg)](https://github.com/clercjs/clerc/blob/main/package.json)

</div>

<hr/>

<!-- toc -->

- [✨ Features](#-features)
- [😊 The simplest CLI example](#-the-simplest-cli-example)
- [📖 Documentation](#-documentation)
- [🦄 Examples](#-examples)
- [🤔 More...](#-more) - [Why using Clerc?](#why-using-clerc) - [Why naming "Clerc"?](#why-naming-clerc) - [📝 License](#-license)
<!-- tocstop -->

> [!NOTE]  
> This package is ESM-only.

# ✨ Features

- **Lightweight** - Dependencies are bundled and minified
- **Plugin system** - Add rich features on demand.
- **Chainable APIs** - Composable.
- **Developer friendly** - Strongly typed, converts flags and parameters to camelCase.
- **Parses parameters** - No need to read them by yourself.
- **I18N** - Easy to change different locales.

# 😊 The simplest CLI example

Install clerc, and create a file named `cli.mjs`:

```ts
import { Clerc } from "clerc";

Clerc.create(
	"foo", // CLI Name
	"A foo CLI", // CLI Description
	"0.0.0", // CLI Version
)
	.command(
		"bar", // Command name
		"A bar command", // Command description
	)
	.on(
		"bar",
		(
			_ctx, // The command context, but we haven't used it yet
		) => {
			console.log("Hello, world from Clerc.js!");
		},
	)
	.parse(); // Parse the arguments and run!
```

Then run: `node cli.mjs bar`. It should log in your shell: `Hello, world from Clerc.js!`

# 📖 Documentation

Please see https://clerc.js.org.

# 🦄 Examples

Check the examples made with `Clerc.js`:

- [Greeting](./examples/greeting) - The example from above
- [Bumpp](./examples/bumpp) - Reimplementation of [`Bumpp`](https://github.com/antfu/bumpp)'s CLI

# 🤔 More...

## Why using Clerc?

Clerc uses [`type-flag`](https://github.com/privatenumber/type-flag) to parse arguments. It is strongly-typed, which brings you better DX. It is powerful(supports custom type) and quite small!

And clerc uses [`lite-emit`](https://github.com/so1ve/lite-emit) to emit events. It is a event emitter library but with better type support.

The whole bundled and minified `@clerc/core` package is only 10KB (ignored types), which is much smaller than yargs, commander, CAC and oclif :)

## Why naming "Clerc"?

Hiroki Osame's [`cleye`](https://github.com/privatenumber/cleye) is an awesome tool for building CLI apps. Its name sounds quite nice, so I also found an English name `Clerc` for this package =)

## 📝 License

[MIT](./LICENSE). Made with ❤️ by [Ray](https://github.com/so1ve)
