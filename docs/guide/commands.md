---
title: Commands & Routing
---

# Commands & Routing

In Clerc, command names, subcommand paths, and positional arguments live in a single route-style signature string passed to `.command()`.

## Defining Commands

```ts
import { clerc } from "clerc";

const cli = clerc({
  name: "git-lite",
  version: "1.0.0",
});

cli.command("clone <repo> [dir]", {
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
```

## Subcommands & Namespaces

Separate subcommand segments with spaces. Any parent path without a `run` handler acts as a **namespace**: invoking `acme db` prints subcommand help for `db`, while mistyping `acme db migrat` suggests `db migrate`.

```ts
const cli = clerc({ name: "acme", version: "1.0.0" });

// Optional metadata-only parent gives the namespace a description in root --help
cli.command("db", {
  description: "Database management commands",
});

cli.command("db migrate", {
  aliases: "m",
  description: "Run pending migrations",
  run(ctx) {
    ctx.calledAs; // "db migrate" or "db m"
    ctx.commandPath; // ["db", "migrate"]
  },
});

cli.command("db seed", {
  description: "Seed sample data",
  run(ctx) {
    ctx.log.success("Seeded database");
  },
});
```

Global flags can appear **before or after** the subcommand path on the command line: both `acme -v db migrate` and `acme db migrate -v` resolve to `db migrate`.

## Single-Command CLIs (Root Command)

If your tool does not use subcommands (like `curl` or `bumpp`), omit the command name or pass an options object directly to `cli.command(options)`:

::: code-group

```ts [Root with flags only]
import { clerc } from "clerc";

const cli = clerc({ name: "serve", version: "1.0.0" }).command({
  description: "Start a static file server",
  flags: {
    port: { type: Number, short: "p", default: 3000 },
  },
  run(ctx) {
    ctx.log.info(`Listening on http://localhost:${ctx.flags.port}`);
  },
});
```

```ts [Root with positional args]
import { clerc } from "clerc";

const cli = clerc({ name: "bumpp", version: "1.0.0" }).command("[files...]", {
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

## Default Subcommand (`defaultCommand`)

Tools like `vite` have subcommands (`vite build`, `vite preview`), yet running bare `vite` or `vite ./my-app` invokes `vite dev`. Pass `defaultCommand` in `clerc()`:

```ts
import { clerc } from "clerc";

const cli = clerc({
  name: "vite",
  version: "1.0.0",
  defaultCommand: "dev",
});

cli.command("dev [root]", {
  description: "Start dev server",
  flags: { port: { type: Number, short: "p", default: 5173 } },
  run(ctx) {
    ctx.log.info(`Serving ${ctx.args.root ?? "."} on ${ctx.flags.port}`);
  },
});

cli.command("build [root]", {
  description: "Build for production",
  run() {},
});
```

How Clerc routes `defaultCommand`:

- `vite` or `vite -p 3000` -> runs `dev`.
- `vite --help` or `vite --version` -> prints root help (marking `dev` with `[default]`) or version.
- If `dev` accepts positional arguments (`dev [root]`), `vite ./app` forwards `./app` to `dev`.
- If `dev` takes **no** positional arguments, `vite biuld` still throws `UnknownCommandError` and suggests `'build'`.

## Wrapper Commands (`stopAtFirstPositional`)

When building a task runner like `npx` or `exec <cmd> [args...]` where flags after `<cmd>` belong to the child process rather than your CLI, enable `stopAtFirstPositional`:

```ts
cli.command("exec <cmd> [args...]", {
  stopAtFirstPositional: true,
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
```

## Lazy-Loaded Handlers

For large CLIs with heavy dependencies, dynamically `import()` the implementation inside `run` so `--help` and other commands pay zero module-loading cost:

```ts no-twoslash
cli.command("analyze <entry>", {
  description: "Analyze bundle size",
  async run(ctx) {
    const { runBundleAnalysis } = await import("./commands/analyze.js");
    await runBundleAnalysis(ctx);
  },
});
```

## Deprecating Commands

Mark legacy commands with `deprecated: true` or a migration message. Clerc tags them in `--help` and logs a warning to `stderr` when invoked (silenced automatically under `-q`):

```ts
cli.command("init-legacy", {
  deprecated: "use 'acme create' instead",
  run() {},
});
```
