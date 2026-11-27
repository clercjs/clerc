---
title: 中间件
---

<script setup>
import { onionState } from "../../guide/middleware.playground.ts";
</script>

# 中间件

Clerc 使用洋葱中间件包裹命令执行，同时支持在中间件内打包共享选项、校验规则、错误处理器以及强类型 `ctx.state`。中间件只在匹配到可执行命令且参数校验通过后运行，`--help` 和 `--version` 会直接短路返回，不会触发数据库连接或鉴权逻辑。

## 简写洋葱函数

直接向 `middleware()` 传入 `(ctx, next) => ...` 函数。配合 `try / finally` 包裹 `await next()`，即使下游命令抛错也能确保资源释放或耗时统计执行：

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

## 通过 `setup` 与 `run` 注入强类型 `ctx.state`

所有中间件注入的数据统一存放在 `ctx.state` 中，避免与 Clerc 内置的 `ctx.args`、`ctx.flags`、`ctx.log`、`ctx.terminal` 等字段冲突。

使用对象形式 `middleware({ use, flags, check, onError, setup, run })` 时，`setup(ctx)` 直接返回要合并进 `ctx.state` 的对象；无论是同一个中间件自身的 `run(ctx, next)`（方便在 `finally` 中关闭连接），还是所有下游中间件和命令，都会自动获得推导出的 `ctx.state` 类型：

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

<CliPlayground :scenario="onionState" lang="zh" />

## 执行顺序与引用去重

中间件按**拓扑依赖 + 词法数组顺序**执行：

1. 若中间件 `B` 声明了 `use: [A]`，`A` 会先于 `B` 展开。
2. 中间件按对象引用（`Set`）自动去重：即便同时在 `command("users", { use: [withDb] })`（用于静态类型推导）和外层 `use(withDb, [users])` 或 `cli({ use: [withDb] })` 中传入同一个 `withDb`，运行期也**只会执行一次**。
3. `use: [first, second]` 中排在前面的位于最外层——将 `updateNotifier()` 放在 `cli({ use: [updateNotifier(), ...] })` 首位，就能最先发起检查，并在内层中间件清理完毕后再打印升级提示。

## 模块类型扩充（`CustomState`）

编写需要读取全局约定状态的工具函数时，可通过扩充 `"clerc"` 的 `CustomState` 接口声明字段类型：

```ts
declare module "clerc" {
  interface CustomState {
    readonly requestId?: string;
  }
}
```
