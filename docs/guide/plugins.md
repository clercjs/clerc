---
title: Composition & Plugins
---

<script setup>
import { authPluginDemo, rbacMetaDemo } from "./plugins.playground.ts";
</script>

# Composition & Plugins

Clerc does not have a separate `Plugin` class. Reusable capabilities—both within your own codebase and published as npm packages—are plain functions returning **`Middleware`**, **`Command`**, or **`Command[]`**:

| Pattern            | Returns                | Examples                                          | Mounted via                               |
| ------------------ | ---------------------- | ------------------------------------------------- | ----------------------------------------- |
| Middleware factory | `Middleware<F, S>`     | `withAuth()`, `updateNotifier()`                  | `cli({ use: [...] })` or `use(mw, cmds)`  |
| Command / bundle   | `Command \| Command[]` | `mcp()`, `completions()`, feature command modules | `commands: [...]` or `group(title, cmds)` |

## Scoped Reusable Middlewares

Write a factory function returning `middleware({ ... })` (omit an explicit return type annotation so TypeScript preserves the inferred flag and `ctx.state` types). Attach it globally on `cli({ use })` or scope it lexically to specific commands with `use(mw, commands)`:

```ts
import { cli, command, group, middleware, use } from "clerc";

export const withAuth = (defaultRole = "viewer") =>
  middleware({
    flags: {
      token: {
        type: String,
        env: "ACME_TOKEN",
        description: "API authentication token",
      },
    },
    setup(ctx) {
      const user = ctx.flags.token
        ? { name: "ray", role: "admin" as const }
        : { name: "guest", role: defaultRole };

      return { user };
    },
  });

const auth = withAuth();

const whoami = command("whoami", {
  use: [auth],
  run(ctx) {
    ctx.flags.token;
    //        ^?
    ctx.state.user;
    //        ^?
    ctx.log.info(`${ctx.state.user.name} (${ctx.state.user.role})`);
  },
});

const ping = command("ping", {
  run(ctx) {
    ctx.log.success("pong");
  },
});

const app = cli({
  name: "acme",
  version: "1.0.0",
  commands: [group("Account", use(auth, [whoami])), ping],
});
```

Because `auth` is passed via `use(auth, [whoami])` rather than root `cli`, `ping` stays completely untouched—it neither accepts nor displays `--token`. Meanwhile, referencing the same `auth` instance in both `whoami`'s `use: [auth]` and `use(auth, [whoami])` is automatically deduplicated.

<CliPlayground :scenario="authPluginDemo" lang="en" />

## Typed `meta` Augmentation

Commands, flags, and arguments each accept an open `meta` object for declarative per-command metadata read by middlewares or tools (such as `meta.mcp` in `@clerc/plugin-mcp`).

Augment `CommandCustomMeta`, `FlagCustomMeta`, or `ArgCustomMeta` so callers get autocomplete and type checking inside `meta`:

```ts
import { ClercError, cli, command, middleware } from "clerc";

declare module "clerc" {
  interface CommandCustomMeta {
    readonly permissions?: readonly ("read" | "write" | "admin")[];
  }
}

const withRbac = middleware(async (ctx, next) => {
  const required = ctx.command.meta?.permissions;
  if (required?.includes("admin")) {
    ctx.log.debug("Checking admin permission...");
  }
  await next();
});

const nuke = command("nuke", {
  meta: { permissions: ["admin"] },
  run() {},
});

const app = cli({
  name: "acme",
  version: "1.0.0",
  use: [withRbac],
  commands: [nuke],
});
```

<CliPlayground :scenario="rbacMetaDemo" lang="en" />
