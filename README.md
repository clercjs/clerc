![Clerc Card](.github/assets/ClercCard.png)

<p align="center">
  <a target="_blank" href="https://clerc.so1ve.dev" noreferrer noopener>Clerc</a> is a strongly-typed CLI framework for Node.js 24+, with pure functional combinators, built-in help, Cargo-style diagnostics, structured logging, shell completions, and MCP support.
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
- **Pure functional combinators & narrowed constraints** - Compose CLIs from plain values with `cli`, `command`, `middleware`, `group`, and `use`. Flag constraint combinators (`oneOf`, `exclusive`, `together`, `atLeastOne`) narrow `ctx.flags` as TypeScript discriminated unions.
- **Standard Schema v1 everywhere** - Pass Zod, Valibot, ArkType, or built-in `Types.Enum` / `Types.Integer` / `Types.Number` / `Types.String` / `Types.Regex` directly to `type`. One schema drives runtime validation, TypeScript output types, `--help` placeholders, shell completion candidates, and MCP JSON Schemas.
- **Editorial `--help`, typo hints, and `ctx.log` built in** - Every CLI gets aligned `--help` pages (command/flag groups, examples, notes), Cargo-style error diagnostics with Levenshtein suggestions (`buid` -> `'build'`, `--prt` -> `'--port'`), and a structured logger (`step`, `box`, `spinner`, `task`, streaming `.line()`, and JSON mode).
- **Shell completions and MCP server from one definition** - Add `completions()` from `@clerc/plugin-completions` for Bash, Zsh, Fish, and PowerShell tab-completion. Add `mcp()` from `@clerc/plugin-mcp` and `<cli> mcp` exposes your commands as Model Context Protocol tools and help pages as resources.
- **In-memory testing without `process.exit()`** - `await app.run(["deploy", "prod"], { terminal: createMemoryTerminal() })` captures `stdout`, `stderr`, and `exitCode` in memory without mutating globals or killing your test runner.

## Quick Start

```sh
pnpm add clerc
```

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

const app = cli({
  name: "acme",
  version: "2.0.0",
  description: "Build and deploy TypeScript services",
  commands: [deploy],
});

await app.runMain();
```

Running `acme deploy --help` renders:

```text
acme deploy v2.0.0  alias: d
Deploy service to target environment

USAGE
  acme deploy [options] <env> [region]

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
error unknown command 'deply'

  tip a similar command exists: 'deploy'

      For more information, try 'acme --help'.
```

## Middleware, Lexical Scoping & MCP

Middlewares encapsulate shared flags, checks, `setup` state, and `run` lifecycle hooks, and scope cleanly to command subtrees with `use()` and `group()`:

```ts
import { completions } from "@clerc/plugin-completions";
import { mcp } from "@clerc/plugin-mcp";
import { cli, command, group, middleware, oneOf, use } from "clerc";

const withDb = middleware({
  flags: [
    {
      databaseUrl: {
        type: String,
        env: "DATABASE_URL",
        default: "sqlite://local.db",
      },
    },
    oneOf(
      { token: { type: String, required: true, env: "ACME_TOKEN" } },
      { tokenFile: { type: String, required: true, env: "ACME_TOKEN_FILE" } },
    ),
  ],
  async setup(ctx) {
    // Discriminated union narrows tokenFile to string when token is undefined
    const auth = ctx.flags.token ?? (await readTokenFile(ctx.flags.tokenFile));
    const db = await connectDb(ctx.flags.databaseUrl, auth);

    return { db };
  },
  async run(ctx, next) {
    try {
      await next();
    } finally {
      await ctx.state.db.close();
    }
  },
});

const listUsers = command("users list", {
  use: [withDb],
  meta: { mcp: { readOnly: true } },
  async run(ctx) {
    // ctx.state.db is inferred directly from withDb.setup()
    const users = await ctx.state.db.query("SELECT id, email FROM users");
    ctx.log.info(`Found ${users.length} users`);
  },
});

const app = cli({
  name: "acme",
  version: "2.0.0",
  commands: [
    group("Admin", use(withDb, [listUsers])),
    completions(), // adds 'acme completions [shell]'
    mcp(), // adds 'acme mcp' stdio server
  ],
});
```

## Testing in Memory

```ts
import { createMemoryTerminal } from "clerc";
import { expect, test } from "vitest";

test("previews staging deploy", async () => {
  const terminal = createMemoryTerminal({ env: { PORT: "8080" } });
  const result = await app.run(["deploy", "staging", "-n"], { terminal });

  expect(result.ok).toBe(true);
  expect(terminal.stdoutText()).toContain("port=8080");
});
```

## Packages

| Package                                                              | Description                                                                                                                                                    |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`clerc`](./packages/clerc)                                          | Core framework: POSIX argv parser, `cli`, `command`, `middleware`, `group`, `use`, constraint combinators, help renderer, diagnostics, and Standard Schema v1. |
| [`@clerc/logger`](./packages/logger)                                 | CLI logger with aligned word labels, `node:util` object/error formatting, streaming `.line()`, `box`, `spinner`, `task`, and JSON output.                      |
| [`@clerc/theme`](./packages/theme)                                   | Zero-dependency semantic ANSI theme and terminal color/Unicode detection.                                                                                      |
| [`@clerc/plugin-completions`](./packages/plugin-completions)         | Zero-dependency shell completions (`completions()`) for Bash, Zsh, Fish, and PowerShell with async context-aware `complete()`.                                 |
| [`@clerc/plugin-mcp`](./packages/plugin-mcp)                         | Zero-dependency MCP stdio server (`mcp()`) exposing CLI commands as tools and help pages as resources.                                                         |
| [`@clerc/plugin-update-notifier`](./packages/plugin-update-notifier) | Zero-dependency background npm update checker middleware (`updateNotifier()`) and banner renderer.                                                             |

## Documentation & Examples

- **Documentation**: [clerc.so1ve.dev](https://clerc.so1ve.dev)
- **Examples**: [`examples/acme`](./examples/acme) (full v2 tour) · [`examples/logger`](./examples/logger) · [`examples/bumpp`](./examples/bumpp) · [`examples/greeting`](./examples/greeting)

## License

[MIT](./LICENSE). Made by [Ray](https://github.com/so1ve).
