import type { Readable, Writable } from "node:stream";

import { plugin } from "clerc";

import type {
  CreateMcpHandlerOptions,
  McpJsonRpcError,
  McpJsonRpcRequest,
  McpJsonRpcResponse,
  McpRequestHandler,
  McpResourceDefinition,
} from "./protocol";
import {
  MCP_PROTOCOL_VERSION,
  createMcpHandler,
  listMcpResources,
  listMcpTools,
  serveMcpStdio,
} from "./protocol";
import type {
  McpCommandMeta,
  McpToolAnnotations,
  McpToolDefinition,
} from "./schema";

export type {
  CreateMcpHandlerOptions,
  McpCommandMeta,
  McpJsonRpcError,
  McpJsonRpcRequest,
  McpJsonRpcResponse,
  McpRequestHandler,
  McpResourceDefinition,
  McpToolAnnotations,
  McpToolDefinition,
};
export {
  MCP_PROTOCOL_VERSION,
  createMcpHandler,
  listMcpResources,
  listMcpTools,
  serveMcpStdio,
};

export interface McpPluginOptions {
  /**
   * Subcommand name that starts the MCP stdio server.
   *
   * @default "mcp"
   */
  readonly command?: string;
  /**
   * Custom MCP server name reported in `initialize`. Defaults to
   * `ctx.meta.scriptName`.
   */
  readonly serverName?: string;
  /**
   * Expose CLI overview and command help pages as MCP resources.
   *
   * @default true
   */
  readonly resources?: boolean;
  /**
   * Optional predicate controlling which command paths are exposed as MCP tools
   * and help resources.
   */
  readonly filter?: (commandPath: readonly string[]) => boolean;
  /**
   * Custom input stream (defaults to `process.stdin`).
   */
  readonly input?: Readable;
  /**
   * Custom output stream (defaults to `process.stdout`).
   */
  readonly output?: Writable;
}

export function mcpPlugin(options: McpPluginOptions = {}) {
  const {
    command: commandName = "mcp",
    serverName,
    resources = true,
    filter,
    input,
    output,
  } = options;

  return plugin("clerc:mcp").command(commandName, {
    description: "Start an MCP stdio server exposing CLI commands as tools",
    async run(ctx) {
      const handler = createMcpHandler({
        model: ctx.model,
        run: ctx.run,
        env: ctx.terminal.env,
        cwd: ctx.terminal.cwd,
        serverName,
        mcpCommandName: commandName,
        resources,
        filter,
      });

      await serveMcpStdio(handler, input, output);
    },
  });
}
