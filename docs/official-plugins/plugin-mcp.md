---
title: "@clerc/plugin-mcp"
---

<script setup>
import { mcpRpc } from "./plugin-mcp.playground.ts";
</script>

# @clerc/plugin-mcp

Exposes any Clerc CLI as a zero-dependency **Model Context Protocol (MCP)** stdio server. Every runnable command becomes a typed MCP tool, and every `--help` page becomes an ANSI-free MCP resource that AI agents (Claude Desktop, Cursor, Windsurf, Zed, etc.) can read and invoke through your full validation and middleware pipeline.

## Installation

::: code-group

```sh [pnpm]
pnpm add @clerc/plugin-mcp
```

```sh [npm]
npm install @clerc/plugin-mcp
```

:::

## Usage

Add `mcp()` directly to `commands: [...]`:

```ts
import { mcp } from "@clerc/plugin-mcp";
import { Types, cli, command } from "clerc";

const deploy = command("deploy <env>", {
  description: "Deploy service to target environment",
  args: {
    env: {
      type: Types.Enum("staging", "prod"),
      description: "Target environment",
    },
  },
  flags: {
    dryRun: { type: Boolean, description: "Preview without deploying" },
  },
  meta: {
    mcp: {
      destructive: true,
    },
  },
  run(ctx) {
    ctx.log.success(`Deployed ${ctx.args.env}`);
  },
});

const status = command("status", {
  description: "Check cluster health",
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
  description: "Manage Acme deployments and databases",
  commands: [deploy, status, mcp()],
});

await app.runMain();
```

Point any MCP client at `acme mcp`:

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

<CliPlayground :scenario="mcpRpc" lang="en" />

## `McpOptions` Reference

| Option       | Type                                          | Default           | Description                                                               |
| ------------ | --------------------------------------------- | ----------------- | ------------------------------------------------------------------------- |
| `command`    | `string`                                      | `"mcp"`           | Subcommand name that starts the MCP stdio server.                         |
| `serverName` | `string`                                      | `model.meta.name` | Server name reported in MCP `initialize`.                                 |
| `resources`  | `boolean`                                     | `true`            | Expose root and command `--help` pages as `cli://...` MCP text resources. |
| `filter`     | `(commandPath: readonly string[]) => boolean` | —                 | Predicate controlling which command paths are exposed as tools/resources. |
| `input`      | `Readable`                                    | `process.stdin`   | Custom JSON-RPC input stream.                                             |
| `output`     | `Writable`                                    | `process.stdout`  | Custom JSON-RPC output stream.                                            |

## Per-Command `meta.mcp` Annotations

Importing `@clerc/plugin-mcp` augments `CommandCustomMeta` with typed `meta.mcp` options:

| Property      | Type      | Description                                                                             |
| ------------- | --------- | --------------------------------------------------------------------------------------- |
| `enabled`     | `boolean` | Force-include (`true`) a hidden command or exclude (`false`) a public command from MCP. |
| `name`        | `string`  | Override the MCP tool name (defaults to `command_path` joined by `_`).                  |
| `description` | `string`  | Override the tool description shown to the LLM.                                         |
| `readOnly`    | `boolean` | Sets MCP `annotations.readOnlyHint`.                                                    |
| `destructive` | `boolean` | Sets MCP `annotations.destructiveHint`.                                                 |
| `idempotent`  | `boolean` | Sets MCP `annotations.idempotentHint`.                                                  |

## Programmatic Handler API

Embed the JSON-RPC 2.0 MCP handler directly in HTTP/SSE transports or unit tests with `createMcpHandler`, `listMcpTools`, `listMcpResources`, and `serveMcpStdio`:

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
