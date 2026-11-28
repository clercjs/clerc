---
title: 插件
---

<script setup>
import { authPluginDemo, rbacMetaDemo } from "../../guide/plugins.playground.ts";
</script>

# 插件

Clerc 没有单独的 `Plugin` 类。无论是业务内部抽离的可复用模块，还是发布到 npm 的第三方插件，本质上都只是返回 **`Middleware`**、**`Command`** 或 **`Command[]`** 的普通函数：

| 形态          | 返回值                 | 示例                                     | 挂载方式                                  |
| ------------- | ---------------------- | ---------------------------------------- | ----------------------------------------- |
| 中间件工厂    | `Middleware<F, S>`     | `withAuth()`、`updateNotifier()`         | `cli({ use: [...] })` 或 `use(mw, cmds)`  |
| 命令 / 命令集 | `Command \| Command[]` | `mcp()`、`completions()`、业务子命令模块 | `commands: [...]` 或 `group(title, cmds)` |

## 词法作用域中间件封装

编写返回 `middleware({ ... })` 的工厂函数（无需手写返回类型标注，以便 TypeScript 完整保留选项与 `ctx.state` 的推导类型），既可挂在根 `cli({ use })` 上，也可用 `use(mw, commands)` 仅挂载给部分命令：

```ts
import { cli, command, group, middleware, use } from "clerc";

export const withAuth = (defaultRole = "viewer") =>
  middleware({
    flags: {
      token: {
        type: String,
        env: "ACME_TOKEN",
        description: "API 认证令牌",
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

由于 `auth` 是通过 `use(auth, [whoami])` 局部挂载的，同级的 `ping` 完全不受影响——既不接受也不展示 `--token`；而在 `whoami` 的 `use: [auth]` 和外层 `use(auth, [whoami])` 中复用的同一个 `auth` 实例会自动按引用去重。

<CliPlayground :scenario="authPluginDemo" lang="zh" />

## `meta` 元数据扩充

命令、选项和参数均支持开放的 `meta` 字段，适合由命令声明静态元数据、由中间件或外部工具消费（例如 `@clerc/plugin-mcp` 读取的 `meta.mcp`）。

通过扩充 `CommandCustomMeta`、`FlagCustomMeta` 或 `ArgCustomMeta`，即可为 `meta` 提供完整的类型检查与自动补全：

```ts
import { cli, command, middleware } from "clerc";

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

<CliPlayground :scenario="rbacMetaDemo" lang="zh" />
