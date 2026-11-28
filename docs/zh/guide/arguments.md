---
title: 位置参数
---

# 位置参数

位置参数直接在命令签名中用尖括号 `<必填>` 和方括号 `[可选]` 声明。

## 签名语法对照

| 语法            | 含义                       | 默认推导的 `ctx.args` 类型 |
| --------------- | -------------------------- | -------------------------- |
| `<env>`         | 必填单个参数               | `string`                   |
| `[region]`      | 可选单个参数               | `string \| undefined`      |
| `<files...>`    | 必填可变参数（至少 1 个）  | `string[]`                 |
| `[files...]`    | 可选可变参数（0 个或多个） | `string[]`                 |
| `-- [extra...]` | 捕获 `--` 之后的参数       | `string[]`                 |

签名中的连字符命名会自动转为 `ctx.args` 上的驼峰属性名（例如 `<out-dir>` 对应 `ctx.args.outDir`）。

```ts
import { command } from "clerc";

const copy = command("copy <source-path> [dest-path] [extra-files...]", {
  args: {
    sourcePath: { description: "源文件路径" },
    destPath: { default: "./dist", description: "目标目录" },
    extraFiles: { unique: true, description: "附加文件列表" },
  },
  run(ctx) {
    ctx.args;
    //  ^?
  },
});
```

::: tip 编译期键名校验
`args: { ... }` 中的属性名严格受命令签名约束，拼错成 `sourcePth` 会在编译期直接报错。可变参数还支持 `unique`、`minItems` 与 `maxItems` 约束。
:::

<CliPlayground demo="arguments/signature" />

## 默认值与环境变量回退（`env`）

可选参数支持 `default`（值或工厂函数），必填与可选参数均支持 `env` 环境变量回退：

```ts
import { command } from "clerc";

// ---cut---
const deploy = command("deploy <token> [region]", {
  args: {
    token: {
      env: "DEPLOY_TOKEN",
      description: "部署令牌",
    },
    region: {
      default: "us-east-1",
      description: "部署区域",
    },
  },
  run(ctx) {
    ctx.args.token;
    //       ^?
    ctx.args.region;
    //       ^?
  },
});
```

当绑定了 `env` 的必填参数既未通过命令行传入、环境变量也未设置时，诊断输出会自动附上提示：

<CliPlayground demo="arguments/envFallback" />

## `--` 分隔符与透传参数

根据命令签名中是否包含 `--`，Clerc 对 `--` 之后的参数有三种处理方式：

1. **签名中在 `--` 后声明了参数**（如 `"test [filter] -- [vitest-args...]"`）：`--` 前绑定到 `filter`，`--` 后绑定到 `ctx.args.vitestArgs` 并参与类型转换与帮助文档生成。
2. **签名以裸 `--` 结尾**（如 `"run <script> --"`）：`--` 后的内容仅保留在 `ctx.raw.doubleDash` 中，不触发多余参数报错。
3. **签名不含 `--`**（如 `"rm <file>"`）：遵循 POSIX 惯例，`acme rm -- -weird-name.txt` 会将 `-weird-name.txt` 作为普通位置参数传给 `<file>`。

<CliPlayground demo="arguments/doubleDash" />
