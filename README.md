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

- **Command Tree & Lazy Loading** — First-class nested subcommands, aliases, leading global flags, and `load()` for instant startup.
- **Typed Hook Plugin System** — Structured lifecycle hooks (`onIntercept`, `onValidate`, `beforeRun`, `afterRun`, `onError`, `onRenderError`) and type-safe `extendContext` without global module pollution.
- **Standard Schema v1** — Use Zod, Valibot, ArkType, or built-in `Types` directly for flags and arguments, with `env` fallbacks, `conflicts`, and `implies`.
- **Modern Precision UI & First-Class Logger** — Built-in `ctx.log` (compact, rail, and JSON/NDJSON modes), Cargo/Clap-inspired diagnostics, and aligned terminal-width-aware help output powered by `node:util` `styleText`.
- **Testable by Design** — Pure per-invocation `cli.run(argv, { terminal })` with `createMemoryTerminal()`, zero `process.exit()` side effects.

# 😊 Quick Start

```ts
import { Cli, Types } from "clerc";

await Cli({
  scriptName: "acme",
  description: "Build and deploy modern TypeScript apps",
  version: "2.0.0",
})
  .command(
    "deploy",
    {
      description: "Deploy application to target environment",
      parameters: [
        {
          key: "<target>",
          type: Types.Enum("staging", "prod"),
          description: "Target environment",
        },
      ] as const,
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
    },
    (ctx) => {
      ctx.log.step(
        `Deploying to ${ctx.parameters.target} on port ${ctx.flags.port}`,
      );
      if (ctx.flags.dryRun) {
        ctx.log.info("Dry run enabled, no changes applied.");
      } else {
        ctx.log.success("Deployed!");
      }
    },
  )
  .runMain();
```

# 📦 Packages

- `clerc` — Batteries-included CLI package with built-in plugins (`help`, `version`, `not-found`, `error`, `strict-flags`, `verbosity`, `update-notifier`).
- `@clerc/core` — Core runtime: CommandTree, execution pipeline, typed plugin engine, Standard Schema v1, `Terminal`, `Theme`, and `Logger`.
- `@clerc/parser` — Zero-dependency, high-performance argument parser.
- `@clerc/plugin-completions` — Shell completion generator powered by `@bomb.sh/tab`.

# 📖 Documentation

Please see https://clerc.so1ve.dev.

# 🦄 Examples

- [Greeting](./examples/greeting)
- [Bumpp](./examples/bumpp)

# 📝 License

[MIT](./LICENSE). Made with ❤️ by [Ray](https://github.com/so1ve)
