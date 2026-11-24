---
title: "@clerc/plugin-mcp"
---

# `@clerc/plugin-mcp`

Exposes any Clerc CLI as a zero-dependency **Model Context Protocol (MCP)** stdio server. Every runnable command becomes a typed MCP tool, and every `--help` page becomes an ANSI-free MCP resource that AI agents (Claude Desktop, Cursor, Windsurf, Zed, etc.) can read and invoke through your full validation and middleware pipeline.

<CliPlayground preset="mcp" lang="en" />

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

```ts
import { mcpPlugin } from "@clerc/plugin-mcp";
import { Types, clerc } from "clerc";

const cli = clerc({
  name: "acme",
  version: "2.0.0",
  description: "Manage Acme deployments and databases",
}).use(mcpPlugin());

cli.command("deploy <env>", {
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

cli.command("status", {
  description: "Check cluster health",
  meta: {
    mcp: { readOnly: true, idempotent: true },
  },
  run(ctx) {
    ctx.terminal.stdout("healthy");
  },
});

await cli.runMain();
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

You can also embed the JSON-RPC 2.0 MCP handler directly in custom transports or tests using `createMcpHandler`, `listMcpTools`, and `listMcpResources`.
