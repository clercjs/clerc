---
title: Context
---

# Context

Every command handler, middleware, and error handler receives a typed context object (`ctx`). All terminal I/O, environment reads, help rendering, and early exits flow through `ctx`, keeping commands pure, testable, and free of global `process.*` coupling.

## Context Hierarchy

Clerc narrows the context type progressively through the execution lifecycle:

| Type                                    | Available in                 | Key guarantees                                                                                |
| --------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------- |
| `CliContext<TFlags, TState>`            | `onError(err, ctx)`          | Runs even on parse or routing errors; `command`, `calledAs`, `flags`, `state` may be partial. |
| `MiddlewareContext<TFlags, TState>`     | `middleware` `setup` / `run` | `command`, `calledAs`, `flags`, and `state` are resolved and typed.                           |
| `CommandContext<TArgs, TFlags, TState>` | `command` / `cli` `run`      | Adds strongly typed `args` inferred from the command signature and `args` map.                |

### Built-in Properties on `ctx`

| Property          | Type                                     | Description                                                                                                                 |
| ----------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `ctx.args`        | `TArgs`                                  | Parsed and validated positional arguments.                                                                                  |
| `ctx.flags`       | `TFlags`                                 | Parsed and validated command, middleware, and global flags.                                                                 |
| `ctx.state`       | `State<TState>`                          | Typed state returned by upstream middleware `setup()` hooks.                                                                |
| `ctx.log`         | `Logger`                                 | Structured logger with `step`, `info`, `success`, `warn`, `error`, `debug`, `box`, `task`, `spinner`, `raw`, `child`.       |
| `ctx.terminal`    | `Terminal`                               | Abstracted `stdout`, `stderr`, `env`, `argv`, `cwd()`, `isTTY`, `isInputTTY`, `readStdin()`, `color`, `unicode`, `columns`. |
| `ctx.help`        | `{ render, print }`                      | Render or print `--help` for the root CLI or any command path.                                                              |
| `ctx.run`         | `(argv, options?) => Promise<RunResult>` | Re-entrantly invoke another command on the same CLI instance.                                                               |
| `ctx.exit`        | `(code?: number) => never`               | Exit cleanly with a specific exit code without calling `process.exit()`.                                                    |
| `ctx.command`     | `Command`                                | Matched `Command` definition (including `meta`).                                                                            |
| `ctx.commandPath` | `readonly string[]`                      | Canonical command segments (e.g. `["db", "migrate"]`).                                                                      |
| `ctx.calledAs`    | `string`                                 | Invoked command or alias string (e.g. `"db m"`).                                                                            |
| `ctx.model`       | `CliModel`                               | Compiled immutable CLI model (`meta`, `tree`, `globalFlags`, `groups`).                                                     |
| `ctx.raw`         | `{ argv, unknown, doubleDash }`          | Raw `argv`, unrecognized flags (under `strictFlags: false`), and post-`--` tokens.                                          |

## Clean Early Exits (`ctx.exit`)

Use `ctx.exit(code)` when a command needs to stop with a non-zero (or zero) exit code—for example, a linter or diff command exiting with `1` or `3` after printing its own output—without rendering an `error` diagnostic or killing the process abruptly:

```ts
import { command } from "clerc";

const checkFormat = command("format-check", {
  flags: { ok: Boolean },
  run(ctx) {
    if (ctx.flags.ok) {
      ctx.exit(0);
    }

    ctx.log.warn("3 files need formatting");
    ctx.exit(3);
  },
});
```

- Middleware `finally` blocks still execute cleanly.
- `onError` handlers are **not** triggered (use `throw new ClercError(...)` when you want structured error diagnostics).
- `app.run()` resolves to `{ ok: code === 0, exitCode: code }`, and `app.runMain()` sets `process.exitCode = code`.

## Reading Piped Stdin (`ctx.terminal.readStdin`)

Use `ctx.terminal.isInputTTY` and `await ctx.terminal.readStdin()` to support UNIX pipelines alongside file arguments or interactive prompts:

```ts
import { command } from "clerc";

const lint = command("lint [file]", {
  async run(ctx) {
    if (!ctx.args.file && !ctx.terminal.isInputTTY) {
      const source = await ctx.terminal.readStdin();
      ctx.log.info(`Read ${source.length} bytes from stdin`);

      return;
    }

    ctx.log.info(`Linting ${ctx.args.file ?? "."}`);
  },
});
```

In tests, pass `stdin` to `createMemoryTerminal({ stdin: "hello\n" })`, which automatically sets `isInputTTY: false` and serves the string from `ctx.terminal.readStdin()`.

## Invoking Subcommands Programmatically (`ctx.run`)

Commands and middlewares can dispatch another command on the same CLI via `await ctx.run(argv, options)`:

```ts
import { command } from "clerc";

const release = command("release", {
  async run(ctx) {
    const buildRes = await ctx.run(["build", "--minify"], {
      terminal: ctx.terminal,
    });
    if (!buildRes.ok) {
      ctx.exit(buildRes.exitCode);
    }
    ctx.log.success("Release ready");
  },
});
```

## Non-Strict Flags and `ctx.raw`

By default, `strictFlags` is `true`, so any unrecognized flag throws `UnknownFlagError` with a typo suggestion. Set `strictFlags: false` on `cli()` to collect unknown flags into `ctx.raw.unknown` instead:

```ts
import { cli, command } from "clerc";

const proxy = command("proxy", {
  run(ctx) {
    ctx.raw.argv; // original argv passed to run()
    ctx.raw.unknown; // e.g. { extra: "1", debug: true }
    ctx.raw.doubleDash; // tokens after "--"
  },
});

const app = cli({
  name: "acme",
  version: "1.0.0",
  strictFlags: false,
  commands: [proxy],
});
```

## Global `cli()` Options Reference

| Option        | Type                              | Default | Description                                                                                |
| ------------- | --------------------------------- | ------- | ------------------------------------------------------------------------------------------ |
| `name`        | `string`                          | `"cli"` | Program name used in `--help`, `--version`, diagnostics, completions, and MCP.             |
| `version`     | `string`                          | `""`    | Enables built-in `-V, --version` and the `version` subcommand when non-empty.              |
| `description` | `string`                          | `""`    | Short CLI summary shown in help output and MCP resources.                                  |
| `examples`    | `MetaAsyncGetter<ExampleInput[]>` | —       | Root help examples (static array or `(meta) => ...` sync/async function).                  |
| `notes`       | `MetaAsyncGetter<string[]>`       | —       | Root help notes (static array or `(meta) => ...` sync/async function).                     |
| `help`        | `boolean \| HelpOptions`          | `true`  | Customize help sections/header/footer/renderer, disable `help` subcommand, or turn off.    |
| `verbosity`   | `boolean`                         | `true`  | Auto-registers `-v, --verbose` (`debug`) and `-q, --quiet` (`error`) unless overridden.    |
| `strictFlags` | `boolean`                         | `true`  | Reject unknown flags with `UnknownFlagError`; set `false` to collect in `ctx.raw.unknown`. |
| `theme`       | `Partial<ThemeStyleMap>`          | —       | Override ANSI style tokens globally for help, diagnostics, and `ctx.log`.                  |
| `logger`      | `LoggerOptions`                   | —       | Default `level` and `scope` passed to `ctx.log`.                                           |
| `use`         | `Middleware[]`                    | `[]`    | Global middlewares applied to every user command.                                          |
| `flags`       | `FlagsInput`                      | `{}`    | Global flags, groups, and constraints inherited by every user command.                     |
| `check`       | `CheckInput`                      | —       | Global cross-field check function(s) run before middlewares.                               |
| `onError`     | `ErrorHandler`                    | —       | Root fallback error interceptor.                                                           |
| `commands`    | `CommandItem[]`                   | `[]`    | Commands, nested arrays, `group(...)`, `use(...)`, `completions()`, `mcp()`.               |
| `default`     | `Command`                         | —       | Default subcommand when invoked without a subcommand (mutually exclusive with `run`).      |
| `run`         | `CommandHandler`                  | —       | Root handler for single-command CLIs (mutually exclusive with `default`).                  |

::: tip Built-in flags yield automatically
Built-in `-h, --help`, `-V, --version`, `-v, --verbose`, and `-q, --quiet` automatically yield if your command or middleware defines a flag with the same long name or short alias. For example, defining `host: { type: String, short: "h" }` keeps `--help` active without a `-h` collision.
:::
