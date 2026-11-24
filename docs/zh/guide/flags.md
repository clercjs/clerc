---
title: 选项
---

<script setup>
import scenario from "../../guide/flags.playground.ts";
</script>

# 选项

在 `flags` 中使用驼峰命名定义选项，命令行会自动同时接受 `--kebab-case` 与 `--camelCase`。

<CliPlayground :scenario="scenario" lang="zh" />

## 简写与完整配置

只需要指定类型时可直接传入构造函数或 Schema；需要短选项、默认值、环境变量或约束时传入配置对象：

```ts
import { Types, clerc } from "clerc";

const cli = clerc({ name: "acme", version: "1.0.0" });

cli.command("serve", {
  flags: {
    open: Boolean, // 简写：boolean（默认 false）
    host: String, // 简写：string | undefined
    port: {
      type: Types.Range(1, 65_535),
      short: "p",
      aliases: ["listen"],
      default: 3000,
      env: "PORT",
      description: "监听端口",
    },
  },
  run(ctx) {
    ctx.flags;
    //  ^?
  },
});
```

## 支持的命令行写法

- **长选项**：`--port 8080` 或 `--port=8080`
- **短选项**：`-p 8080`、`-p=8080` 或紧贴写法 `-p8080`
- **短选项合并**：`-vrn` 等价于 `-v -r -n`；`-vo dist` 会开启 `-v` 并将 `dist` 传给 `-o`
- **布尔取反**：`Boolean` 默认支持 `--no-<flag>`（当 `default: true` 时，`--help` 会自动展示 `--cache, --no-cache`；可通过 `negatable: false` 关闭）
- **显式布尔值**：`--cache=false`、`--cache=0`、`--cache=true`、`--cache=1`

## 数组选项、分隔符与计数器

通过 `multiple: true` 收集多次传入的值为数组，或使用 `Types.Counter` 统计重复出现的次数：

```ts
import { Types, clerc } from "clerc";

const cli = clerc({ name: "acme", version: "1.0.0" });

cli.command("build", {
  flags: {
    // 支持重复传入与逗号切分：-t a,b -t c -> ["a", "b", "c"]
    tags: {
      type: String,
      multiple: true,
      short: "t",
      delimiter: ",",
      description: "发布标签",
    },
    // 计数器：Types.Counter 统计出现次数：-vvv -> 3（未传时为 0）
    verbose: {
      type: Types.Counter,
      short: "v",
      description: "日志详细程度",
    },
  },
  run(ctx) {
    ctx.flags.tags;
    //        ^?
    ctx.flags.verbose;
    //        ^?
  },
});
```

## 可选值选项（`implicitValue`）

类似 `node --inspect` 或 `git log --color` 的选项：不传时为 `undefined`（或 `default`），单独传 `--inspect` 时取 `implicitValue`，显式传 `--inspect=9230` 时取解析后的值：

```ts
cli.command("dev", {
  flags: {
    inspect: {
      type: Number,
      short: "I",
      implicitValue: 9229,
      description: "开启调试端口",
    },
  },
  run(ctx) {
    // $ acme dev                -> undefined
    // $ acme dev --inspect      -> 9229
    // $ acme dev --inspect=9230 -> 9230
    ctx.flags.inspect;
    //        ^?
  },
});
```

::: info 显式传值请使用 `=`
为避免把后面的位置参数误吞为选项值（例如 `acme dev -I src/index.ts`），为带有 `implicitValue` 的选项显式指定值时请使用 `--inspect=9230` 或 `-I9230`。
:::

## 声明式约束：`required`、`conflicts` 与 `implies`

```ts
cli.command("deploy", {
  flags: {
    token: {
      type: String,
      required: true,
      env: "ACME_TOKEN",
    },
    json: {
      type: Boolean,
      conflicts: ["yaml"], // 与 --yaml 互斥
    },
    yaml: {
      type: Boolean,
    },
    tlsKey: {
      type: String,
      implies: ["tlsCert"], // 传入 --tls-key 时必须同时提供 --tls-cert
    },
    tlsCert: {
      type: String,
    },
  },
  run(ctx) {
    ctx.flags.token;
    //        ^?
  },
});
```

## 全局选项与局部覆盖

在 `cli.flags({ ... })` 或 `plugin().flags({ ... })` 上注册全局选项后，所有命令的 `ctx.flags` 都会自动合并全局与局部选项类型。如果某个子命令定义了同名局部选项，该子命令内优先使用局部选项的类型与配置。
