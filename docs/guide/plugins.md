---
title: Plugins
---

# Plugins

In Clerc v2, `Clerc` extends `Plugin`. Both share the exact same methods:

- `.flags()` - register global flags
- `.groups()` - register help section groups (`commands`, `flags`, `globalFlags`)
- `.command()` - register commands or subcommand namespaces
- `.middleware()` - wrap execution and inject typed `ctx.state`
- `.onError()` - register LIFO error handlers
- `.use()` - compose child plugins

## Writing a Plugin

Create a plugin with `plugin("scope:name")` and chain what it provides. Always omit an explicit `: Plugin` return type annotation on factory functions so TypeScript preserves the inferred flag and `ctx.state` types:

```ts
import { clerc, plugin } from "clerc";

export const authPlugin = (defaultRole = "viewer") =>
  plugin("acme:auth")
    .flags({
      token: {
        type: String,
        env: "ACME_TOKEN",
        description: "API authentication token",
      },
    })
    .middleware(async (ctx, next) => {
      const user = ctx.flags.token
        ? { name: "ray", role: "admin" as const }
        : { name: "guest", role: defaultRole };

      return next({ user });
    });

const cli = clerc({ name: "acme", version: "1.0.0" }).use(authPlugin());

cli.command("whoami", {
  run(ctx) {
    ctx.flags.token;
    //        ^?
    ctx.state.user;
    //        ^?
    ctx.log.info(`${ctx.state.user.name} (${ctx.state.user.role})`);
  },
});
```

## Deduplication & Atomic Overrides

Every plugin has a `pluginName` (such as `"acme:auth"` or `"clerc:verbosity"`). If multiple plugins `.use()` a shared dependency, Clerc runs it once. If the root CLI calls `.use(authPlugin("editor"))` after a preset bundle already registered `"acme:auth"`, the later instance atomically replaces the earlier one at its dependency slot.

## Typed `meta` Augmentation

Commands, flags, and arguments each accept an open `meta` object for user-written, plugin-read configuration (used by `@clerc/plugin-mcp` and `@clerc/plugin-completions`).

Augment `CommandCustomMeta`, `FlagCustomMeta`, or `ArgCustomMeta` so users get autocomplete and type checking inside `meta`:

```ts
import { clerc, plugin } from "clerc";

declare module "clerc" {
  interface CommandCustomMeta {
    readonly permissions?: readonly ("read" | "write" | "admin")[];
  }
}

const rbacPlugin = plugin("acme:rbac").middleware(
  async (ctx, next) => {
    const required = ctx.command.meta?.permissions;
    if (required?.includes("admin")) {
      ctx.log.debug("Checking admin permission...");
    }
    await next();
  },
  { enforce: "post" },
);

const cli = clerc({ name: "acme", version: "1.0.0" })
  .use(rbacPlugin)
  .command("nuke", {
    meta: { permissions: ["admin"] },
    run() {},
  });
```
