---
title: 中间件
---

<script setup>
import scenario from "../../guide/middleware.playground.ts";
</script>

# 中间件

Clerc 采用洋葱模型中间件包裹命令执行。中间件只在匹配到可执行命令且参数校验通过后运行，`--help` 和 `--version` 会直接返回，不会触发数据库连接或鉴权逻辑。

<CliPlayground :scenario="scenario" lang="zh" />

## 洋葱生命周期与资源清理

调用 `await next()` 进入下游中间件与命令处理函数。配合 `try / finally` 可以在同一个作用域内释放连接或记录耗时：

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

## 通过 `next({ ... })` 注入强类型 `ctx.state`

业务和插件注入的状态统一存放在 `ctx.state` 中，避免与 Clerc 内置的 `ctx.args`、`ctx.flags`、`ctx.log`、`ctx.terminal` 等属性冲突。

向 `next({ ... })` 传入状态对象并将其返回，下游中间件与命令处理函数即可自动获得对应的 TypeScript 类型：

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

## 执行顺序与 `enforce`

默认情况下，中间件严格按 `.use()` / `.middleware()` 的注册顺序执行。由于插件会将中间件封装在内部，用户无需关心 `.use()` 顺序即可让基础设施插件固定在正确层级：

1. `{ enforce: "pre" }`：最外层，进入时**最先**执行，`finally` 退出时**最后**执行（例如 `@clerc/plugin-update-notifier` 用它尽早发起检查，并在清理日志之后打印提示框）。
2. _(默认)_：普通中间件，按注册顺序执行。
3. `{ enforce: "post" }`：最内层，在普通中间件完成 `ctx.state` 注入之后、`command.run()` 之前执行（适合权限校验或审计）。

::: tip `enforce: "pre"` 的编译期保护
由于 `"pre"` 中间件在运行期先于普通中间件执行，Clerc 会在类型层面将其 `ctx.state` 收窄，防止误读尚未执行的普通中间件所注入的状态。
:::

## 模块类型扩充（`CustomState`）

拆分独立命令文件时，可通过扩充 `"clerc"` 的 `CustomState` 接口声明全局状态字段：

```ts
declare module "clerc" {
  interface CustomState {
    readonly requestId?: string;
  }
}
```
