---
title: 错误处理
---

<script setup>
import { clercError, typoSuggestions } from "../../guide/errors.playground.ts";
</script>

# 错误处理

命令行用法错误退出码为 `2`，运行期与 Schema 校验错误退出码为 `1`。遇到未知命令或选项时，Clerc 会查找最相近的名称并给出建议。

## 拼写提示

<CliPlayground :scenario="typoSuggestions" lang="zh" />

## 抛出自定义 `ClercError`

在业务代码中抛出 `ClercError` 即可获得风格一致的 `detail`、`tip` 和 `usage` 输出：

```ts
import { ClercError, clerc } from "clerc";

const cli = clerc({ name: "acme", version: "1.0.0" }).command("publish", {
  run() {
    throw new ClercError("尚未登录制品仓库", {
      code: "ERR_AUTH",
      detail: "未在 ~/.acmerc 或 ACME_TOKEN 中找到凭证",
      usage: "acme login --registry https://registry.example.com",
    }).addHint("请先运行 'acme login' 或设置环境变量 ACME_TOKEN");
  },
});
```

<CliPlayground :scenario="clercError" lang="zh" />

## 自定义 `.onError()` 拦截

通过 `.onError((err, ctx) => ...)` 按后进先出（LIFO）顺序拦截错误。返回 `true` 表示已处理，不再打印默认错误诊断：

```ts
const cli = clerc({ name: "acme", version: "1.0.0" }).onError((err, ctx) => {
  ctx.log.error("执行失败", err.message);

  return true;
});
```
