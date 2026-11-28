---
title: 错误处理
---

# 错误处理

命令行解析、参数校验与约束违反错误默认退出码为 `2`（用法错误），并自动附带 `usage` 行与 `--help` 提示；定义期错误（`InvalidSchemaError`）与业务 `ClercError` 默认退出码为 `1`。遇到未知命令、未知选项或非法枚举值时，Clerc 会自动查找最相近的候选并给出拼写建议。

## 拼写提示

<CliPlayground demo="errors/typoSuggestions" />

## 内置错误类一览

所有内置错误均继承自 `ClercError`，携带结构化的 `code` 与 `exitCode`：

| 错误类                         | `code`                    | `exitCode` | 触发场景                                                                       |
| ------------------------------ | ------------------------- | ---------- | ------------------------------------------------------------------------------ |
| `UnknownCommandError`          | `ERR_UNKNOWN_COMMAND`     | `2`        | 子命令不匹配任何已注册命令或别名（附带拼写建议）。                             |
| `NoCommandError`               | `ERR_NO_COMMAND`          | `2`        | 关闭 `help: false` 且无根 `run` 时未传入任何子命令。                           |
| `UnknownFlagError`             | `ERR_UNKNOWN_FLAG`        | `2`        | `strictFlags: true` 下出现未知选项（附带拼写建议）。                           |
| `MissingRequiredFlagError`     | `ERR_MISSING_FLAG`        | `2`        | 必填选项既未在命令行传入，也未设置对应环境变量。                               |
| `MissingFlagValueError`        | `ERR_MISSING_FLAG_VALUE`  | `2`        | 取值选项未跟值（若后续是以 `-` 开头的词，提示 `--flag=-val` 写法）。           |
| `MissingRequiredArgumentError` | `ERR_MISSING_ARGUMENT`    | `2`        | 必填位置参数 `<arg>` 缺失且无环境变量回退。                                    |
| `UnexpectedArgumentError`      | `ERR_UNEXPECTED_ARGUMENT` | `2`        | 传入了超出命令签名的多余位置参数。                                             |
| `ValidationError`              | `ERR_VALIDATION`          | `2`        | 类型转换、Standard Schema 或数组约束（`unique`/`minItems`/`maxItems`）失败。   |
| `ConstraintError`              | `ERR_CONSTRAINT`          | `2`        | 选项约束组合子（`oneOf`/`exclusive`/`together`/`atLeastOne`）或 `check` 失败。 |
| `InvalidSchemaError`           | `ERR_INVALID_SCHEMA`      | `1`        | 命令、参数或选项定义本身存在冲突或非法配置（编译期抛出）。                     |
| `ClercError`                   | `ERR_CLI`（默认）         | `1`        | 命令业务代码中抛出的自定义错误。                                               |

## 抛出自定义 `ClercError`

在业务代码中抛出 `ClercError` 即可获得风格一致的 `code`、`exitCode`、`detail`、`hints`、`usage` 与 `cause` 输出：

```ts
import { ClercError, cli, command } from "clerc";

const publish = command("publish", {
  run() {
    throw new ClercError("尚未登录制品仓库", {
      code: "ERR_AUTH",
      exitCode: 1,
      detail: "未在 ~/.acmerc 或 ACME_TOKEN 中找到凭证",
      usage: "acme login --registry https://registry.example.com",
    }).addHint("请先运行 'acme login' 或设置环境变量 ACME_TOKEN");
  },
});

const app = cli({
  name: "acme",
  version: "1.0.0",
  commands: [publish],
});
```

<CliPlayground demo="errors/clercError" />

::: tip 堆栈输出与无诊断退出

- 设置环境变量 `DEBUG=1` 或传入 `-v` / `--verbose` 时，默认诊断输出会自动附带完整错误堆栈。
- 如果命令希望自行打印输出并以指定退出码结束，而不渲染错误块、也不触发 `onError`，请使用 `ctx.exit(code)`。详见 [上下文](/zh/guide/context#优雅提前退出-ctx-exit)。

:::

## 自定义 `onError` 拦截

在 `cli()`、`middleware()` 或 `command()` 上传入 `onError(err, ctx)`，会按后进先出（LIFO）顺序拦截错误（子命令最先执行，其次由内向外执行中间件，最后是根 `cli`）。返回 `true` 表示已处理，不再打印默认错误诊断：

```ts
import { cli } from "clerc";

const app = cli({
  name: "acme",
  version: "1.0.0",
  onError(err, ctx) {
    ctx.log.error("执行失败", Error.isError(err) ? err.message : err);

    return true;
  },
});
```

如需手动格式化任意错误，也可直接使用导出的 `formatDiagnostic(error, { theme, name, commandPath, verbose, showHelpHint })`。
