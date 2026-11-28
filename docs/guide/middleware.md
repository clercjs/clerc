---
title: Middleware
---

# Middleware

Middlewares wrap command execution in an onion pipeline and can bundle shared flags, checks, error handlers, and typed `ctx.state`. Middleware only runs after a command matches and passes validation; built-in `--help` and `--version` requests return immediately without opening connections or running auth checks.

## Shorthand Onion Middleware

Pass an async function `(ctx, next) => ...` to `middleware()`. Wrap `await next()` in `try / finally` to guarantee cleanup even if downstream handlers throw:

```ts
import { cli, middleware } from "clerc";

const withTiming = middleware(async (ctx, next) => {
  const start = performance.now();
  try {
    await next();
  } finally {
    const ms = (performance.now() - start).toFixed(1);
    ctx.log.debug(`${ctx.calledAs} completed in ${ms}ms`);
  }
});

const app = cli({
  name: "acme",
  version: "1.0.0",
  use: [withTiming],
});
```

## Injecting Typed `ctx.state` (`setup` + `run`)

All middleware-injected data lives in `ctx.state`, keeping Clerc's built-in context properties (`ctx.args`, `ctx.flags`, `ctx.log`, `ctx.terminal`, `ctx.help`, `ctx.model`) isolated from naming collisions.

Use the object form of `middleware({ use, flags, check, onError, setup, run })` to declare flags and return derived state directly from `setup(ctx)`. Both the middleware's own `run(ctx, next)` (for `try / finally` resource cleanup) and all downstream middlewares and commands receive the inferred `ctx.state` type automatically:

```ts
import { cli, command, middleware } from "clerc";

const withDb = middleware({
  flags: {
    config: { type: String, default: "acme.json" },
  },
  async setup(ctx) {
    const db = {
      url: `sqlite://${ctx.flags.config}`,
      query: async (sql: string) => [{ id: 1, sql }],
      close: async () => {},
    };

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

const users = command("users", {
  use: [withDb],
  async run(ctx) {
    ctx.state.db;
    //        ^?
    const rows = await ctx.state.db.query("SELECT * FROM users");
    ctx.log.info(`Loaded ${rows.length} rows`);
  },
});

const app = cli({
  name: "acme",
  version: "1.0.0",
  use: [withDb],
  commands: [users],
});
```

<CliPlayground demo="middleware/onionState" />

## Execution Order and Deduplication

Middlewares execute in **topological + lexical order**:

1. If middleware `B` declares `use: [A]`, `A` is expanded before `B`.
2. Middlewares are deduplicated by object reference (`Set`), so referencing `withDb` on both `command("users", { use: [withDb] })` (for static typing) and `use(withDb, [users])` or `cli({ use: [withDb] })` runs `withDb` **exactly once**.
3. Outer middlewares in `use: [first, second]` wrap inner ones—place infrastructure middlewares like `updateNotifier()` first in `cli({ use: [updateNotifier(), ...] })` so they start earliest and finish after inner `finally` blocks.

## Module Augmentation (`CustomState`)

When authoring standalone helpers that expect ambient state across the application, augment `CustomState` on `"clerc"`:

```ts
declare module "clerc" {
  interface CustomState {
    readonly requestId?: string;
  }
}
```
