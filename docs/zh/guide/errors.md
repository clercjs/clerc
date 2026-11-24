---
title: 错误处理
---

<script setup>
import scenario from "../../guide/errors.playground.ts";
</script>

# 错误处理

命令行用法错误退出码为 `2`，运行期与 Schema 校验错误退出码为 `1`。遇到未知命令或选项时，Clerc 会查找最相近的名称并给出建议。

<CliPlayground :scenario="scenario" lang="zh" />

## 拼写提示

<TerminalWindow command="acme deploy prod --outpt dist" :lines='["{red:error} unexpected option: &#39;--outpt&#39;","","  {tip:tip} a similar option exists: &#39;--output&#39;","","      {muted:For more information, try &#39;acme deploy --help&#39;.}"]' />

## 抛出自定义 `ClercError`

在业务代码中抛出 `ClercError` 即可获得风格一致的 `detail`、`tip` 和 `usage` 输出：

```ts
import { ClercError, clerc } from "clerc";

const cli = clerc({ name: "acme", version: "1.0.0" }).command("publish", {
  run() {
    throw new ClercError("尚未登录制品仓库", {
      code: "ERR_VALIDATION",
      detail: "未在 ~/.acmerc 或 ACME_TOKEN 中找到凭证",
      usage: "acme login --registry https://registry.example.com",
    }).addHint("请先运行 'acme login' 或设置环境变量 ACME_TOKEN");
  },
});
```

## 自定义 `.onError()` 拦截

通过 `.onError((err, ctx) => ...)` 按后进先出（LIFO）顺序拦截错误。返回 `true` 表示已处理，不再打印默认错误诊断：

```ts
const cli = clerc({ name: "acme", version: "1.0.0" }).onError((err, ctx) => {
  ctx.log.error("执行失败", err.message);

  return true;
});
```

## JSON 错误输出

当 `ctx.log.format === "json"`（或配置 `logger: { format: "json" }`）时，未捕获错误会自动以单行 JSON 输出到 `stderr`，方便脚本和 CI 解析：

```json
{
  "error": {
    "code": "ERR_UNKNOWN_COMMAND",
    "message": "unknown command 'buid'",
    "hints": ["a similar command exists: 'build'"],
    "exitCode": 2
  }
}
```
