---
title: 测试
---

# 测试

Clerc 核心执行管线完全不依赖全局 `process.argv`、`process.env` 或 `process.exit()`，所有命令、中间件和错误诊断都可以在内存中直接做单元测试。

## 使用 `createMemoryTerminal()` 编写测试

`createMemoryTerminal()` 会创建隔离的内存 `Terminal`，支持自定义 `env`、`cwd`、`stdin`、`isTTY`、`isInputTTY`、`color`、`unicode` 与 `columns`，并提供 `stdoutText()` / `stderrText()` / `clear()` 辅助方法：

```ts
import { Types, cli, command, createMemoryTerminal } from "clerc";
import { expect, test } from "vitest";

const deploy = command("deploy <env>", {
  args: { env: Types.Enum("staging", "prod") },
  flags: {
    token: { type: String, required: true, env: "ACME_TOKEN" },
  },
  run(ctx) {
    ctx.log.success(`Deployed to ${ctx.args.env}`);
  },
});

const app = cli({
  name: "acme",
  version: "2.0.0",
  commands: [deploy],
});

test("读取模拟环境变量并校验枚举参数", async () => {
  const terminal = createMemoryTerminal({
    env: { ACME_TOKEN: "secret_123" },
  });

  const ok = await app.run(["deploy", "staging"], { terminal });
  expect(ok.ok).toBe(true);
  expect(ok.exitCode).toBe(0);
  expect(terminal.stdoutText()).toContain("Deployed to staging");

  terminal.clear();
  const bad = await app.run(["deploy", "qa"], { terminal });
  expect(bad.ok).toBe(false);
  expect(bad.exitCode).toBe(2);
  expect(terminal.stderrText()).toContain("expected one of: 'staging', 'prod'");
});
```

<CliPlayground demo="testing/memoryTerminal" />

## 直接断言异常实例（`throwOnError`）

如果想在测试中用 `rejects.toThrow(...)` 直接断言具体的 `ClercError` 子类，传入 `throwOnError: true` 即可跳过默认的 `stderr` 渲染并向外抛出原始错误对象：

```ts
import { MissingRequiredFlagError, createMemoryTerminal } from "clerc";
// ---cut-start---
import { expect } from "vitest";

declare const app: import("clerc").Cli;
// ---cut-end---

await expect(
  app.run(["deploy", "prod"], {
    terminal: createMemoryTerminal(),
    throwOnError: true,
  }),
).rejects.toThrow(MissingRequiredFlagError);
```

## 读取编译后的 `CliModel`

调用 `app.buildModel()` 可以拿到只读的 `CliModel`（`meta`、`tree`、`globalFlags`、`groups`），适合用于自动生成文档、自定义帮助页或静态检查命令配置：

```ts
import { buildHelpDocument, cli, command } from "clerc";

const app = cli({
  name: "acme",
  version: "2.0.0",
  commands: [
    command("build", {
      description: "构建项目",
      run() {},
    }),
  ],
});

const model = app.buildModel();
const helpAst = await buildHelpDocument(model);
// helpAst.commandGroups[0].items -> [{ name: "build", ... }]
```

<CliPlayground demo="testing/inspectModel" />
