---
title: Commands
---

# Commands

In Clerc, each command is an immutable value created with `command(spec, options)` and assembled into `cli({ commands: [...] })`.

## Defining Commands

```ts
import { cli, command } from "clerc";

const clone = command("clone <repo> [dir]", {
  aliases: ["c"],
  description: "Clone a repository into a directory",
  flags: {
    depth: { type: Number, description: "Create a shallow clone" },
  },
  run(ctx) {
    ctx.args.repo;
    //       ^?
    ctx.args.dir;
    //       ^?
    ctx.log.info(`Cloning ${ctx.args.repo} into ${ctx.args.dir ?? "."}`);
  },
});

const app = cli({
  name: "git-lite",
  version: "1.0.0",
  commands: [clone],
});
```

## Subcommands and Namespaces

Nest child commands under `commands: [...]` on a parent `command()`. A parent without a `run` handler or `default` acts as a **namespace**: invoking `acme db` prints subcommand help for `db`, while mistyping `acme db migrat` suggests `db migrate`.

```ts
import { cli, command } from "clerc";

const dbMigrate = command("migrate", {
  aliases: ["m", "db-migrate"],
  description: "Run pending migrations",
  run(ctx) {
    ctx.calledAs; // "db migrate" or "db m"
    ctx.commandPath; // ["db", "migrate"]
  },
});

const dbSeed = command("seed", {
  description: "Seed sample data",
  run(ctx) {
    ctx.log.success("Seeded database");
  },
});

const db = command("db", {
  description: "Database management commands",
  commands: [dbMigrate, dbSeed],
});

const app = cli({
  name: "acme",
  version: "1.0.0",
  commands: [db],
});
```

Single-word aliases resolve under the command's parent namespace (`acme db m`), while multi-word aliases register at the full path from root (for example, `aliases: ["db m"]` on a nested command). Global and parent flags can appear **before or after** subcommand names on the command line: both `acme -v db migrate` and `acme db migrate -v` resolve to `db migrate`.

<CliPlayground demo="commands/subcommands" />

## Lexical Scoping (`use` and `group`)

Use `use(middlewares, commands)` to attach shared flags, `setup` state, lifecycle hooks, and `onError` handlers to a specific subset of commands without leaking them to sibling commands. Combine with `group(title, commands)` to organize `--help` output:

```ts
import { cli, command, group, middleware, use } from "clerc";

const withAuth = middleware({
  flags: { token: { type: String, required: true, env: "ACME_TOKEN" } },
  setup: (ctx) => ({ token: ctx.flags.token }),
});

const deploy = command("deploy", {
  use: [withAuth],
  run(ctx) {
    ctx.log.info(`Deploying with ${ctx.state.token}`);
  },
});

const serve = command("serve", {
  run(ctx) {
    // Unaffected by withAuth (--token is neither required nor accepted here)
    ctx.log.info("Starting local server");
  },
});

const app = cli({
  name: "acme",
  version: "1.0.0",
  commands: [group("Admin", use(withAuth, [deploy])), group("Local", [serve])],
});
```

Notice `commands: [...]` flattens nested arrays automatically, so `group(...)` and `use(...)` compose directly without `...` spreads.

## Single-Command CLIs

If your tool does not have subcommands (like `curl` or `bumpp`), pass `run` directly to `cli(options)` or `cli(spec, options)`:

::: code-group

```ts [Flags only]
import { cli } from "clerc";

const app = cli({
  name: "serve",
  version: "1.0.0",
  description: "Start a static file server",
  flags: {
    port: { type: Number, short: "p", default: 3000 },
  },
  run(ctx) {
    ctx.log.info(`Listening on http://localhost:${ctx.flags.port}`);
  },
});
```

```ts [With positional args]
import { cli } from "clerc";

const app = cli("[files...]", {
  name: "bumpp",
  version: "1.0.0",
  description: "Bump package versions",
  flags: {
    yes: { type: Boolean, short: "y" },
  },
  run(ctx) {
    ctx.args.files;
    //       ^?
  },
});
```

:::

## Default Subcommand (`default`)

Tools like `vite` expose subcommands (`vite build`, `vite preview`), yet running bare `vite` or `vite ./my-app` invokes `vite dev`. Pass the target `Command` object directly to `default` on `cli()` or any namespace `command()`:

```ts
import { cli, command } from "clerc";

const dev = command("dev [root]", {
  description: "Start dev server",
  flags: { port: { type: Number, short: "p", default: 5173 } },
  run(ctx) {
    ctx.log.info(`Serving ${ctx.args.root ?? "."} on ${ctx.flags.port}`);
  },
});

const build = command("build [root]", {
  description: "Build for production",
  run() {},
});

const app = cli({
  name: "vite",
  version: "1.0.0",
  commands: [dev, build],
  default: dev,
});
```

How Clerc resolves `default`:

- `vite` or `vite -p 3000` runs `dev`.
- `vite --help` or `vite --version` prints root help (with `[default]` next to `dev`) or the version.
- If `dev` accepts positional arguments (`dev [root]`), `vite ./app` forwards `./app` to `dev`.
- If `dev` takes **no** positional arguments, `vite biuld` still throws `UnknownCommandError` and suggests `'build'`.
- When a parent command instead has its own distinct signature unrelated to any subcommand (such as `pr [id]` alongside `pr ls`), pass `run` directly on the parent `command("pr [id]", { commands: [prLs], run })`.

<CliPlayground demo="commands/defaultCommand" />

## Wrapper Commands (`stopParsing`)

When building a task runner or wrapper command where trailing flags belong to a child process rather than your CLI, configure `stopParsing`. Once triggered, the matching token and all remaining tokens are kept as raw positionals and bound to `ctx.args`:

- `"first-positional"`: stop parsing flags at the first positional argument (ideal for `npx`-style `exec <cmd> [args...]`).
- `"unknown-flag"`: stop parsing flags at the first unrecognized flag and forward it without triggering `UnknownFlagError`.
- `(token) => boolean`: a stateless predicate receiving `{ kind, raw, index, positionalCount }` for custom rules (such as stopping at the Nth positional or a custom sentinel token).

```ts
import { command } from "clerc";

// ---cut---
const execCmd = command("exec <cmd> [args...]", {
  stopParsing: "first-positional",
  flags: {
    quiet: { type: Boolean, short: "q" },
  },
  run(ctx) {
    // $ acme exec -q git --status -s
    // ctx.flags.quiet -> true
    // ctx.args.cmd    -> "git"
    // ctx.args.args   -> ["--status", "-s"]
  },
});

const runCmd = command("run <env> <script> [args...]", {
  stopParsing: (token) =>
    token.kind === "positional" && token.positionalCount === 1,
  flags: { verbose: Boolean },
  run(ctx) {
    // $ acme run prod --verbose app.ts --port 3000
    // ctx.flags.verbose -> true
    // ctx.args.env      -> "prod"
    // ctx.args.script   -> "app.ts"
    // ctx.args.args     -> ["--port", "3000"]
  },
});
```

<CliPlayground demo="commands/stopParsing" />

## Hidden Commands, Dynamic Help Metadata, and Lazy Handlers

- **Hidden commands (`hidden: true`)**: Excluded from `--help`, typo suggestions, shell completions, and MCP tools (unless explicitly enabled via `meta.mcp.enabled: true`), while still callable directly (useful for internal plumbing like `complete`).
- **Dynamic `examples` and `notes`**: Both `examples` and `notes` accept either a static array or a sync/async getter `(meta) => [...]` that receives `CliMeta` (`name`, `version`, `description`).
- **Lazy-loaded handlers**: For large CLIs with heavy dependencies, dynamically `import()` inside `async run(ctx)` so `--help` and other commands pay zero module-loading cost:

```ts
import { command } from "clerc";

// ---cut---
const analyze = command("analyze <entry>", {
  description: "Analyze bundle size",
  examples: (meta) => [
    [`$ ${meta.name} analyze src/index.ts`, "Inspect entry"],
  ],
  async run(ctx) {
    const { runBundleAnalysis } = await import("./commands/analyze.js");
    await runBundleAnalysis(ctx);
  },
});
```

## Deprecating Commands

Mark legacy commands with `deprecated: true` or a migration message. Clerc tags them in `--help` and logs a warning to `stderr` when invoked (silenced automatically under `-q`):

```ts
import { command } from "clerc";

// ---cut---
const initLegacy = command("init-legacy", {
  deprecated: "use 'acme create' instead",
  run() {},
});
```

<CliPlayground demo="commands/deprecated" />
