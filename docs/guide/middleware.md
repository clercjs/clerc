---
title: Middleware
---

<script setup>
import { onionState } from "./middleware.playground.ts";
</script>

# Middleware

Clerc wraps command execution in an onion middleware pipeline. Middleware only runs after a command matches and passes validation; built-in `--help` and `--version` requests return immediately without opening connections or running auth checks.

## Onion Lifecycle and Teardown

Call `await next()` to run downstream middlewares and the matched command handler. Wrap `await next()` in `try / finally` to guarantee cleanup even if the command throws:

```ts
import { clerc } from "clerc";

const cli = clerc({ name: "acme", version: "1.0.0" }).middleware(
  async (ctx, next) => {
    const start = performance.now();
    try {
      await next();
    } finally {
      const ms = (performance.now() - start).toFixed(1);
      ctx.log.debug(`${ctx.calledAs} completed in ${ms}ms`);
    }
  },
);
```

## Injecting Typed `ctx.state`

All user- and plugin-injected runtime data lives in a dedicated `ctx.state` namespace, keeping Clerc's built-in context properties (`ctx.args`, `ctx.flags`, `ctx.log`, `ctx.terminal`, `ctx.help`, `ctx.model`) isolated from naming collisions.

Pass an object to `next({ ... })` and return its result to merge new properties into `ctx.state` with full TypeScript inference for all subsequent middlewares and commands:

```ts
import { clerc } from "clerc";

const cli = clerc({ name: "acme", version: "1.0.0" })
  .flags({
    config: { type: String, default: "acme.json" },
  })
  .middleware(async (ctx, next) => {
    const db = {
      url: `sqlite://${ctx.flags.config}`,
      query: async (sql: string) => [{ id: 1, sql }],
      close: async () => {},
    };

    try {
      return await next({ db });
    } finally {
      await db.close();
    }
  });

cli.command("users", {
  async run(ctx) {
    ctx.state.db;
    //        ^?
    const rows = await ctx.state.db.query("SELECT * FROM users");
    ctx.log.info(`Loaded ${rows.length} rows`);
  },
});
```

<CliPlayground :scenario="onionState" lang="en" />

## Execution Order and `enforce`

By default, middlewares run in registration order (`.use()` and `.middleware()` order). Because plugins encapsulate middlewares behind `.use(somePlugin())`, infrastructure plugins can pin their position in the onion using `{ enforce: "pre" | "post" }`:

1. `enforce: "pre"`: outermost layer, running **first** on entry and **last** in `finally` (used by `@clerc/plugin-update-notifier` to start fetching early and print after teardown logs).
2. _(default)_: normal middleware in registration order.
3. `enforce: "post"`: innermost layer, running right before `command.run()` after normal middleware has populated `ctx.state`.

::: tip Compile-time safety for `enforce: "pre"`
Because a `"pre"` middleware runs before normal middlewares at runtime, Clerc narrows its `ctx.state` parameter at compile time so it cannot accidentally read state injected by normal middlewares registered earlier in the builder chain.
:::

## Module Augmentation (`CustomState`)

When authoring standalone command modules or plugins that expect ambient state, augment `CustomState` on `"clerc"`:

```ts
declare module "clerc" {
  interface CustomState {
    readonly requestId?: string;
  }
}
```
