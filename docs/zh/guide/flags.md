---
title: 选项
---

<script setup>
import { arraysAndCounters, implicitValue } from "../../guide/flags.playground.ts";
</script>

# 选项

在 `flags` 中使用驼峰命名定义选项，命令行会自动同时接受 `--kebab-case` 与 `--camelCase`。

## 简写与完整配置

只需要指定类型时可直接传入构造函数或 Schema；需要短选项、必填、默认值、环境变量或数组约束时传入配置对象：

```ts
import { Types, command } from "clerc";

const serve = command("serve", {
  flags: {
    open: Boolean, // 简写：boolean（默认 false）
    host: String, // 简写：string | undefined
    token: {
      type: String,
      required: true, // 推导为 string（不含 undefined）
      env: "ACME_TOKEN",
      placeholder: "<secret>",
      description: "API 认证令牌",
    },
    port: {
      type: Types.Integer({ min: 1, max: 65_535 }),
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

通过 `multiple: true` 收集多次传入的值为数组（可选搭配 `delimiter`、`unique`、`minItems`、`maxItems`），或使用 `Types.Counter` 统计重复出现的次数：

```ts
import { Types, command } from "clerc";

const build = command("build", {
  flags: {
    // 支持重复传入、逗号切分与数量上下限：-t a,b -t c -> ["a", "b", "c"]
    tags: {
      type: String,
      multiple: true,
      unique: true,
      minItems: 1,
      maxItems: 5,
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

<CliPlayground :scenario="arraysAndCounters" lang="zh" />

## 可选值选项（`implicitValue`）

类似 `node --inspect` 或 `git log --color` 的选项：不传时为 `undefined`（或 `default`），单独传 `--inspect` 时取 `implicitValue`，显式传 `--inspect=9230` 时取解析后的值：

```ts
const dev = command("dev", {
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

<CliPlayground :scenario="implicitValue" lang="zh" />

## 惰性默认值、环境变量解析与可见性

- **惰性默认值函数**：`default: () => ...` 会在每次运行时重新求值（适合动态值或避免共享数组引用）；在函数上挂载 `.display` 属性可自定义 `--help` 中 `[default: ...]` 的展示文本：
  ```ts
  import type { DefaultValueFunction } from "clerc";
  import { command } from "clerc";

  const defaultCwd: DefaultValueFunction<string> = () => process.cwd();
  defaultCwd.display = "current directory";

  const scan = command("scan", {
    flags: {
      dir: { type: String, default: defaultCwd },
    },
    run() {},
  });
  ```
- **环境变量解析规则（`env`）**：
  - `Boolean` 选项解析 `true` / `1` / `false` / `0`（不区分大小写）。
  - `Types.Counter` 解析非负整数（`2` → `2`）或布尔字面量（`true` → `1`、`false` → `0`）。
  - `multiple: true` 数组选项按 `delimiter ?? ","` 切分并对每项做 `trim()`。
  - 若必填选项已由环境变量提供则直接通过；两者皆缺失时报错会自动提示对应环境变量名。
- **隐藏与弃用**：设置 `hidden: true` 可将选项从 `--help`、补全和 MCP Schema 中隐藏（命令行传入时仍可正常解析）；设置 `deprecated: true | "use --new-flag"` 会在 `--help` 标注弃用并在传入时向 `stderr` 输出警告。

## `FlagOptions` 配置项一览

| 配置项          | 类型                           | 说明                                                                    |
| --------------- | ------------------------------ | ----------------------------------------------------------------------- |
| `type`          | `SingleType`                   | 必填。原生构造函数、`Types.*`、自定义解析函数或 Standard Schema v1。    |
| `short`         | `string`                       | 单字符短选项（如 `"p"` 对应 `-p`）。                                    |
| `aliases`       | `string \| string[]`           | 额外长选项别名（如 `["out", "outFile"]`）。                             |
| `description`   | `string`                       | 展示在 `--help`、补全候选与 MCP 工具 Schema 中的说明。                  |
| `placeholder`   | `string`                       | 自定义 `--help` 中的值占位符（默认为 `<类型>`）。                       |
| `default`       | `T \| DefaultValueFunction<T>` | 默认值或惰性工厂函数（与 `required: true` 互斥）。                      |
| `implicitValue` | `T \| DefaultValueFunction<T>` | 仅传选项名未带 `=value` 时的隐式取值（仅限单值选项）。                  |
| `required`      | `boolean`                      | 要求必须通过命令行或环境变量提供（否则抛 `MissingRequiredFlagError`）。 |
| `env`           | `string`                       | 环境变量回退名。                                                        |
| `multiple`      | `boolean`                      | 允许多次传入并收集为数组。                                              |
| `delimiter`     | `string`                       | 数组选项的值分隔符（需配合 `multiple: true`）。                         |
| `unique`        | `boolean`                      | 数组选项元素去重校验。                                                  |
| `minItems`      | `number`                       | 数组选项最少元素个数。                                                  |
| `maxItems`      | `number`                       | 数组选项最多元素个数。                                                  |
| `negatable`     | `boolean`                      | 是否为 `Boolean` 选项启用 `--no-<flag>`（默认 `true`）。                |
| `group`         | `string`                       | 直接指定所属 `--help` 分组名（等价于 `group(title, ...)`）。            |
| `hidden`        | `boolean`                      | 从 `--help`、补全与 MCP 中隐藏。                                        |
| `deprecated`    | `boolean \| string`            | 标记为已弃用并在使用时向 `stderr` 告警。                                |
| `complete`      | `CompletionOption`             | 静态候选、`Complete.*`、`false` 或动态 `complete(ctx)` 函数。           |
| `meta`          | `FlagMeta`                     | 开放元数据对象（可通过 `FlagCustomMeta` 扩展类型）。                    |

## 组合约束与跨命令复用

- **选项分组与约束**：`flags` 既接受普通对象，也接受 `group(title, flags)`、约束组合子（`oneOf`、`exclusive`、`together`、`atLeastOne`）或它们的数组组合，详见 [约束](/zh/guide/constraints)。
- **共享选项与局部覆盖**：将共享选项定义在 `middleware({ flags: { ... } })` 中，通过命令上的 `use: [mw]` 获得完整的 `ctx.flags` 类型推导，并用 `use(mw, commands)` 或 `cli({ use: [mw] })` 控制作用范围。若子命令声明了同名局部选项，该子命令内优先采用局部选项的类型与配置。
