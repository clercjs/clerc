![Clerc Card](.github/assets/ClercCard.png)

<p align="center">
  <a target="_blank" href="https://clerc.so1ve.dev" noreferrer noopener>Clerc</a> is a modern, strongly-typed CLI framework for Node.js 26+.
</p>

<div align="center">

[![Version](https://img.shields.io/npm/v/clerc.svg)](https://npmjs.org/package/clerc)
[![CI](https://github.com/clercjs/clerc/actions/workflows/conventional-ci.yml/badge.svg)](https://github.com/clercjs/clerc/actions/workflows/conventional-ci.yml)
[![Downloads/week](https://img.shields.io/npm/dw/clerc.svg)](https://npmjs.org/package/clerc)
[![License](https://img.shields.io/npm/l/clerc.svg)](https://github.com/clercjs/clerc/blob/main/package.json)

</div>

<hr/>

> [!NOTE]
> ESM-only, targeting Node.js >= 26.

# ✨ Features

- **Route-Style Typed Command Signatures** — Write `"deploy <target> [region] -- [extra...]"` and get full template-literal inference + `args` key autocompletion with zero `as const`.
- **Unified `Cli` & `plugin()` Primitives** — Plugins and apps share the exact same 6 verbs (`.flags()`, `.groups()`, `.command()`, `.extend()`, `.hook()`, `.use()`), with atomic named override via `.use()` and `.disable()`.
- **Standard Schema v1** — Use Zod, Valibot, ArkType, or built-in `Types` directly for flags and arguments, with `env` fallbacks, `conflicts`, and `implies`.
- **Modern Precision UI & First-Class Logger** — Built-in `ctx.log` (compact, rail, and JSON/NDJSON modes), Cargo/Clap-inspired diagnostics, and aligned terminal-width-aware help output powered by `node:util` `styleText`.
- **Testable by Design** — Pure per-invocation `cli.run(argv, { terminal })` with `createMemoryTerminal()`, zero `process.exit()` side effects.

# 😊 Quick Start

```ts
import { Cli, Types } from "clerc";

const cli = Cli({
  scriptName: "acme",
  version: "2.0.0",
  description: "Build and deploy modern TypeScript apps",
});

cli.command("deploy <target> [region]", {
  description: "Deploy application to target environment",
  args: {
    target: {
      type: Types.Enum("staging", "prod"),
      description: "Target environment",
    },
  },
  flags: {
    port: {
      type: Number,
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
    ctx.log.step(`Deploying to ${ctx.args.target} on port ${ctx.flags.port}`);
    if (ctx.flags.dryRun) {
      ctx.log.info("Dry run enabled, no changes applied.");
    } else {
      ctx.log.success("Deployed!");
    }
  },
});

await cli.runMain();
```

# 📦 Packages

- `clerc` — Batteries-included CLI package with built-in plugins (`help`, `version`, `errors`, `strict-flags`, `verbosity`, `update-notifier`).
- `@clerc/core` — Core runtime: `createCli`, `plugin`, `CommandTree`, Standard Schema v1, `Terminal`, `Theme`, and `Logger`.
- `@clerc/parser` — Zero-dependency, high-performance argument parser.
- `@clerc/plugin-completions` — Shell completion generator powered by `@bomb.sh/tab`.

# 📖 Documentation

Please see https://clerc.so1ve.dev.

# 🦄 Examples

- [Greeting](./examples/greeting)
- [Bumpp](./examples/bumpp)

# 📝 License

[MIT](./LICENSE). Made with ❤️ by [Ray](https://github.com/so1ve)
