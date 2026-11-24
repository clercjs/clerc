---
title: 测试与编程式调用
---

# 测试与编程式调用

Clerc 核心执行管线完全不依赖全局 `process.argv`、`process.env` 或 `process.exit()`，所有命令、中间件和错误诊断都可以在内存中直接做单元测试。

<CliPlayground preset="testing" lang="zh" />

## 使用 `createMemoryTerminal()` 编写测试

```ts
import { Types, clerc, createMemoryTerminal } from "clerc";
import { expect, test } from "vitest";

const cli = clerc({ name: "acme", version: "2.0.0" }).command("deploy <env>", {
  args: { env: Types.Enum("staging", "prod") },
  flags: {
    token: { type: String, required: true, env: "ACME_TOKEN" },
  },
  run(ctx) {
    ctx.log.success(`Deployed to ${ctx.args.env}`);
  },
});

test("读取模拟环境变量并校验枚举参数", async () => {
  const terminal = createMemoryTerminal({
    env: { ACME_TOKEN: "secret_123" },
  });

  const ok = await cli.run(["deploy", "staging"], { terminal });
  expect(ok.ok).toBe(true);
  expect(ok.exitCode).toBe(0);
  expect(terminal.stdoutText()).toContain("Deployed to staging");

  terminal.clear();
  const bad = await cli.run(["deploy", "qa"], { terminal });
  expect(bad.ok).toBe(false);
  expect(bad.exitCode).toBe(2);
  expect(terminal.stderrText()).toContain("expected one of: 'staging', 'prod'");
});
```

## 直接断言异常实例（`throwOnError`）

如果想在测试中用 `rejects.toThrow(...)` 直接断言具体的 `ClercError` 子类，传入 `throwOnError: true` 即可跳过默认的 `stderr` 渲染并向外抛出原始错误对象：

```ts no-twoslash
import { MissingRequiredFlagError } from "clerc";

await expect(
  cli.run(["deploy", "prod"], {
    terminal: createMemoryTerminal(),
    throwOnError: true,
  }),
).rejects.toThrow(MissingRequiredFlagError);
```

## 读取编译后的 `CliModel`

调用 `cli.buildModel()` 可以拿到只读的完整命令树与选项元数据模型，适合用于自动生成文档、自定义帮助页或静态检查命令配置。
