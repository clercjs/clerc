![Clerc Card](.github/assets/ClercCard.png)

<p align="center">
  <a target="_blank" href="https://clerc.so1ve.dev" noreferrer noopener>Clerc</a> is a strongly-typed CLI framework for Node.js 24+, with built-in help, Cargo-style diagnostics, structured logging, shell completions, and MCP support.
</p>

<div align="center">

[![Version](https://img.shields.io/npm/v/clerc.svg)](https://npmjs.org/package/clerc)
[![CI](https://github.com/clercjs/clerc/actions/workflows/conventional-ci.yml/badge.svg)](https://github.com/clercjs/clerc/actions/workflows/conventional-ci.yml)
[![Downloads/week](https://img.shields.io/npm/dw/clerc.svg)](https://npmjs.org/package/clerc)
[![License](https://img.shields.io/npm/l/clerc.svg)](https://github.com/clercjs/clerc/blob/main/package.json)

</div>

<hr/>

> [!NOTE]
> ESM-only, targeting Node.js >= 24.

## Why Clerc

- **Signature-driven TypeScript types** - Write `"deploy <env> [region] -- [extra...]"` and get `ctx.args` inferred as `{ env: string; region: string | undefined; extra: string[] }` without `as const`. Typos in `args` or `flags` option keys fail at compile time.
- **Standard Schema v1 everywhere** - Pass Zod, Valibot, ArkType, or built-in `Types.Enum` / `Types.Range` / `Types.Integer` / `Types.Regex` directly to `type`. One schema drives runtime validation, TypeScript output types, `--help` placeholders, shell completion candidates, and MCP JSON Schemas.
- **Editorial `--help`, typo hints, and `ctx.log` built in** - Every CLI gets aligned `--help` pages (command/flag groups, examples, notes), Cargo-style error diagnostics with Levenshtein suggestions (`buid` -> `'build'`, `--prt` -> `'--port'`), and a structured logger (`step`, `box`, `spinner`, `task`, streaming `.line()`, and JSON mode).
- **One API for apps and plugins** - `clerc()` and `plugin()` share `.command()`, `.flags()`, `.groups()`, `.middleware()`, `.onError()`, and `.use()`. Onion middlewares inject typed `ctx.state` via `next({ db })`, clean up in `try / finally`, and support `{ enforce: "pre" | "post" }`.
- **Shell completions and MCP server from one definition** - Add `@clerc/plugin-completions` for Bash, Zsh, Fish, and PowerShell tab-completion. Add `@clerc/plugin-mcp` and `<cli> mcp` exposes your commands as Model Context Protocol tools and help pages as resources for AI agents.
- **In-memory testing without `process.exit()`** - `await cli.run(["deploy", "prod"], { terminal: createMemoryTerminal() })` captures `stdout`, `stderr`, and `exitCode` in memory without mutating globals or killing your test runner.

## Quick Start

```sh
pnpm add clerc
```

```ts
import { Types, clerc, verbosityPlugin } from "clerc";

const cli = clerc({
  name: "acme",
  version: "2.0.0",
  description: "Build and deploy TypeScript services",
}).use(verbosityPlugin());

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
    // ctx.args.env    -> "staging" | "prod"
    // ctx.args.region -> string
    // ctx.flags.port  -> number
    ctx.log.step(
      `Deploying to ${ctx.args.env} (${ctx.args.region})`,
      `port=${ctx.flags.port}`,
    );

    if (ctx.flags.dryRun) {
      ctx.log.box.info("Dry run", "No remote resources were modified.");
    } else {
      ctx.log.success("Deployment complete");
    }
  },
});

await cli.runMain();
```

Running `acme deploy --help` renders:

```text
acme deploy v2.0.0  alias: d
Deploy service to target environment
────────────────────────────────────────────────────────────────────────
USAGE   acme deploy [options] <env> [region]

ARGUMENTS
  <env>                    Target environment  [staging|prod]
  [region]                 Cloud region  [default: us-east-1]

OPTIONS
  -p, --port <1..65535>    Server port  [default: 3000] [env: PORT]
  -n, --dry-run            Preview without deploying

GLOBAL OPTIONS
  -q, --quiet              Suppress non-error output
  -v, --verbose            Enable verbose debug logging
  -h, --help               Show help
```

Mistyping a command or option prints actionable diagnostics:

```text
$ acme deply
error  unknown command 'deply'

tip    a similar command exists: 'deploy'

       For more information, try 'acme --help'.
```

## Plugins, Typed State & MCP

Plugins encapsulate flags, subcommands, and middlewares, then compose onto any CLI with full type inference:

```ts
import { completionsPlugin } from "@clerc/plugin-completions";
import { mcpPlugin } from "@clerc/plugin-mcp";
import { clerc, plugin } from "clerc";

const dbPlugin = plugin("acme:db")
  .flags({
    databaseUrl: {
      type: String,
      env: "DATABASE_URL",
      default: "sqlite://local.db",
    },
  })
  .middleware(async (ctx, next) => {
    const db = await connectDb(ctx.flags.databaseUrl);
    try {
      return await next({ db });
    } finally {
      await db.close();
    }
  });

const cli = clerc({ name: "acme", version: "2.0.0" })
  .use(dbPlugin)
  .use(completionsPlugin()) // adds 'acme completions <shell>'
  .use(mcpPlugin()); // adds 'acme mcp' stdio server

cli.command("users list", {
  meta: { mcp: { readOnly: true } },
  async run(ctx) {
    // ctx.state.db is typed from dbPlugin
    const users = await ctx.state.db.query("SELECT id, email FROM users");
    ctx.log.info(`Found ${users.length} users`);
  },
});
```

## Testing in Memory

```ts
import { createMemoryTerminal } from "clerc";
import { expect, test } from "vitest";

test("previews staging deploy", async () => {
  const terminal = createMemoryTerminal({ env: { PORT: "8080" } });
  const result = await cli.run(["deploy", "staging", "-n"], { terminal });

  expect(result.ok).toBe(true);
  expect(terminal.stdoutText()).toContain("port=8080");
});
```

## Packages

| Package                                                      | Description                                                                                                                                                      |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`clerc`](./packages/clerc)                                  | Core framework: POSIX argv parser, `clerc`, `plugin`, help renderer, diagnostics, Standard Schema v1, `Terminal`, `verbosityPlugin`, and `updateNotifierPlugin`. |
| [`@clerc/logger`](./packages/logger)                         | CLI logger with aligned word labels, `node:util` object/error formatting, streaming `.line()`, `box`, `spinner`, `task`, and JSON output.                        |
| [`@clerc/theme`](./packages/theme)                           | Zero-dependency semantic ANSI theme and terminal color/Unicode detection.                                                                                        |
| [`@clerc/plugin-completions`](./packages/plugin-completions) | Shell completion generator for Bash, Zsh, Fish, and PowerShell powered by `@bomb.sh/tab`.                                                                        |
| [`@clerc/plugin-mcp`](./packages/plugin-mcp)                 | Zero-dependency MCP stdio server exposing CLI commands as tools and help pages as resources.                                                                     |

## Documentation & Examples

- **Documentation**: [clerc.so1ve.dev](https://clerc.so1ve.dev)
- **Examples**: [`examples/acme`](./examples/acme) (full v2 tour) · [`examples/logger`](./examples/logger) · [`examples/bumpp`](./examples/bumpp) · [`examples/greeting`](./examples/greeting)

## License

[MIT](./LICENSE). Made by [Ray](https://github.com/so1ve).
