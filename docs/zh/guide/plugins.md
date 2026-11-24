---
title: 插件
---

<script setup>
import { authPluginDemo, rbacMetaDemo } from "../../guide/plugins.playground.ts";
</script>

# 插件

在 Clerc v2 中，`Clerc` 直接继承自 `Plugin`，两者拥有完全一致的链式方法：

- `.flags()`：注册全局选项
- `.groups()`：注册帮助分组（`commands`、`flags`、`globalFlags`）
- `.command()`：注册命令或子命令命名空间
- `.middleware()`：注册洋葱中间件并注入类型化的 `ctx.state`
- `.onError()`：注册后进先出（LIFO）错误处理器
- `.use()`：组合其他插件

## 编写插件

使用 `plugin("scope:name")` 创建插件。编写插件工厂函数时**不要**手动标注 `: Plugin` 返回类型，让 TypeScript 自动保留插件携带的全局选项和 `ctx.state` 泛型类型：

```ts
import { clerc, plugin } from "clerc";

export const authPlugin = (defaultRole = "viewer") =>
  plugin("acme:auth")
    .flags({
      token: {
        type: String,
        env: "ACME_TOKEN",
        description: "API 认证令牌",
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

<CliPlayground :scenario="authPluginDemo" lang="zh" />

## 同名去重与覆盖

每个插件都有唯一名称（如 `"acme:auth"` 或 `"clerc:update-notifier"`）。多个插件重复 `.use()` 同名依赖时只会加载一次；如果根 CLI 之后再次调用 `.use(authPlugin("editor"))`，新实例会在原有位置替换旧实例。

## `meta` 元数据扩充（用户写、插件读）

与插件写入 `ctx.state` 供命令读取相反，命令、选项和参数提供 `meta` 字段，供用户传入配置、插件读取（例如 `@clerc/plugin-mcp` 使用的 `meta.mcp`）。

通过模块扩充即可为 `meta` 赋予完整的类型检查与自动补全：

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

<CliPlayground :scenario="rbacMetaDemo" lang="zh" />
