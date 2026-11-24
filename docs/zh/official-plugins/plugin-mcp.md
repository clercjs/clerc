---
title: "@clerc/plugin-mcp"
---

# `@clerc/plugin-mcp`

零额外依赖，将任意 Clerc CLI 直接暴露为 **Model Context Protocol (MCP)** stdio 服务器。每个可执行命令都会自动映射为带 JSON Schema 的 MCP Tool，每页 `--help` 文档都会映射为无 ANSI 转义码的 MCP Resource，供 Claude Desktop、Cursor、Windsurf、Zed 等 AI 客户端直接调用。

## 安装

::: code-group

```sh [pnpm]
pnpm add @clerc/plugin-mcp
```

```sh [npm]
npm install @clerc/plugin-mcp
```

:::

## 用法

```ts
import { mcpPlugin } from "@clerc/plugin-mcp";
import { Types, clerc } from "clerc";

const cli = clerc({
  name: "acme",
  version: "2.0.0",
  description: "管理部署与数据库",
}).use(mcpPlugin());

cli.command("deploy <env>", {
  description: "部署服务到指定环境",
  args: {
    env: {
      type: Types.Enum("staging", "prod"),
      description: "目标环境",
    },
  },
  flags: {
    dryRun: { type: Boolean, description: "仅预览不执行" },
  },
  meta: {
    mcp: { destructive: true },
  },
  run(ctx) {
    ctx.log.success(`Deployed ${ctx.args.env}`);
  },
});

cli.command("status", {
  description: "查看集群健康状态",
  meta: {
    mcp: { readOnly: true, idempotent: true },
  },
  run(ctx) {
    ctx.terminal.stdout("healthy");
  },
});

await cli.runMain();
```

在 MCP 客户端中配置启动命令 `acme mcp`：

```json
{
  "mcpServers": {
    "acme": {
      "command": "acme",
      "args": ["mcp"]
    }
  }
}
```

## `meta.mcp` 工具注解选项

| 字段          | 类型      | 说明                                                        |
| ------------- | --------- | ----------------------------------------------------------- |
| `enabled`     | `boolean` | 设为 `false` 排除公开命令，或设为 `true` 强制暴露隐藏命令。 |
| `name`        | `string`  | 自定义 MCP 工具名称（默认将子命令路径以 `_` 拼接）。        |
| `description` | `string`  | 覆盖展示给大模型的工具描述。                                |
| `readOnly`    | `boolean` | 对应 MCP `annotations.readOnlyHint`。                       |
| `destructive` | `boolean` | 对应 MCP `annotations.destructiveHint`。                    |
| `idempotent`  | `boolean` | 对应 MCP `annotations.idempotentHint`。                     |
