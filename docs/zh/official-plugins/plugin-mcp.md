---
title: "@clerc/plugin-mcp"
---

<script setup>
import { mcpRpc } from "../../official-plugins/plugin-mcp.playground.ts";
</script>

# @clerc/plugin-mcp

零依赖将 Clerc CLI 暴露为 **Model Context Protocol (MCP)** stdio 服务。每个可执行命令自动映射为带 JSON Schema 的 MCP Tool，每页 `--help` 文档映射为纯文本 MCP Resource，供 Claude Desktop、Cursor、Windsurf、Zed 等客户端调用。

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

将 `mcp()` 直接加入 `commands: [...]`：

```ts
import { mcp } from "@clerc/plugin-mcp";
import { Types, cli, command } from "clerc";

const deploy = command("deploy <env>", {
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

const status = command("status", {
  description: "查看集群健康状态",
  meta: {
    mcp: { readOnly: true, idempotent: true },
  },
  run(ctx) {
    ctx.terminal.stdout("healthy");
  },
});

const app = cli({
  name: "acme",
  version: "2.0.0",
  description: "管理部署与数据库",
  commands: [deploy, status, mcp()],
});

await app.runMain();
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

<CliPlayground :scenario="mcpRpc" lang="zh" />

## `McpOptions` 配置项

| 配置项       | 类型                                          | 默认值            | 说明                                                    |
| ------------ | --------------------------------------------- | ----------------- | ------------------------------------------------------- |
| `command`    | `string`                                      | `"mcp"`           | 启动 MCP stdio 服务的子命令名称。                       |
| `serverName` | `string`                                      | `model.meta.name` | 在 MCP `initialize` 握手中上报的服务名。                |
| `resources`  | `boolean`                                     | `true`            | 是否将根帮助与各子命令帮助暴露为 `cli://...` 文本资源。 |
| `filter`     | `(commandPath: readonly string[]) => boolean` | —                 | 自定义过滤函数，决定哪些命令路径暴露为 MCP 工具与资源。 |
| `input`      | `Readable`                                    | `process.stdin`   | 自定义 JSON-RPC 输入流。                                |
| `output`     | `Writable`                                    | `process.stdout`  | 自定义 JSON-RPC 输出流。                                |

## `meta.mcp` 工具注解选项

引入 `@clerc/plugin-mcp` 后会自动为 `CommandCustomMeta` 扩展强类型的 `meta.mcp` 配置：

| 字段          | 类型      | 说明                                                        |
| ------------- | --------- | ----------------------------------------------------------- |
| `enabled`     | `boolean` | 设为 `false` 排除公开命令，或设为 `true` 强制暴露隐藏命令。 |
| `name`        | `string`  | 自定义 MCP 工具名称（默认将子命令路径以 `_` 拼接）。        |
| `description` | `string`  | 覆盖展示给大模型的工具描述。                                |
| `readOnly`    | `boolean` | 对应 MCP `annotations.readOnlyHint`。                       |
| `destructive` | `boolean` | 对应 MCP `annotations.destructiveHint`。                    |
| `idempotent`  | `boolean` | 对应 MCP `annotations.idempotentHint`。                     |

## 编程式 Handler API

如需接入自定义传输层（如 HTTP/SSE）或在测试中直接调用，可使用导出的 `createMcpHandler`、`listMcpTools`、`listMcpResources` 与 `serveMcpStdio`：

```ts
import { createMcpHandler, listMcpTools } from "@clerc/plugin-mcp";
import { cli, command } from "clerc";

const app = cli({
  name: "acme",
  version: "2.0.0",
  commands: [command("ping", { run: (ctx) => ctx.terminal.stdout("pong") })],
});

const model = app.buildModel();
const tools = listMcpTools(model);
const handle = createMcpHandler({ model, run: app.run });
const response = await handle({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: { name: "ping", arguments: {} },
});
```
