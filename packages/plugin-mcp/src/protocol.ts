import { createInterface } from "node:readline";
import type { Readable, Writable } from "node:stream";

import type { ReadonlyCliModel, RunOptions, RunResult } from "@clerc/core";
import { createMemoryTerminal, createTheme, renderHelp } from "@clerc/core";

import type {
  McpFilterOptions,
  McpToolDefinition,
  McpToolEntry,
} from "./schema";
import {
  buildToolEntries,
  listExposedCommands,
  serializeToolArgsToArgv,
} from "./schema";

export const MCP_PROTOCOL_VERSION = "2025-03-26";

export interface McpJsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id?: string | number | null;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

export interface McpJsonRpcError {
  readonly code: number;
  readonly message: string;
  readonly data?: unknown;
}

export interface McpJsonRpcResponse {
  readonly jsonrpc: "2.0";
  readonly id: string | number | null;
  readonly result?: unknown;
  readonly error?: McpJsonRpcError;
}

export interface McpResourceDefinition {
  readonly uri: string;
  readonly name: string;
  readonly description: string;
  readonly mimeType: "text/plain";
}

interface ResourceEntry {
  readonly resource: McpResourceDefinition;
  readonly commandPath: readonly string[];
}

export interface CreateMcpHandlerOptions extends McpFilterOptions {
  readonly model: ReadonlyCliModel;
  readonly run: (
    argv: readonly string[],
    options?: RunOptions,
  ) => Promise<RunResult>;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly cwd?: () => string;
  readonly serverName?: string;
  readonly resources?: boolean;
}

export type McpRequestHandler = (
  request: McpJsonRpcRequest,
) => Promise<McpJsonRpcResponse | null>;

const PLAIN_THEME = createTheme(false);

function buildResourceEntries(
  model: ReadonlyCliModel,
  options?: McpFilterOptions,
): readonly ResourceEntry[] {
  const scriptName = model.meta.scriptName || "cli";
  const prefix = `cli://${encodeURIComponent(scriptName)}`;
  const entries: ResourceEntry[] = [
    {
      resource: {
        uri: `${prefix}/help`,
        name: `${scriptName} help`,
        description:
          model.meta.description || `Overview and usage help for ${scriptName}`,
        mimeType: "text/plain",
      },
      commandPath: [],
    },
  ];

  for (const { node, command } of listExposedCommands(model, options)) {
    if (node.fullPath.length === 0) {
      continue;
    }

    const encodedPath = node.fullPath.map(encodeURIComponent).join("/");
    const label = `${scriptName} ${node.fullPath.join(" ")}`;
    entries.push({
      resource: {
        uri: `${prefix}/commands/${encodedPath}`,
        name: `${label} help`,
        description: command.description ?? `Help documentation for '${label}'`,
        mimeType: "text/plain",
      },
      commandPath: node.fullPath,
    });
  }

  return entries;
}

export const listMcpTools = (
  model: ReadonlyCliModel,
  options?: McpFilterOptions,
): readonly McpToolDefinition[] =>
  buildToolEntries(model, options).map((entry) => entry.tool);

export const listMcpResources = (
  model: ReadonlyCliModel,
  options?: McpFilterOptions,
): readonly McpResourceDefinition[] =>
  buildResourceEntries(model, options).map((entry) => entry.resource);

const okResponse = (
  id: string | number | null,
  result: unknown,
): McpJsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  result,
});

const errorResponse = (
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): McpJsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: data === undefined ? { code, message } : { code, message, data },
});

async function handleToolsCall(
  id: string | number | null,
  params: Record<string, unknown> | undefined,
  toolsByName: ReadonlyMap<string, McpToolEntry>,
  run: CreateMcpHandlerOptions["run"],
  env: CreateMcpHandlerOptions["env"],
  cwd: CreateMcpHandlerOptions["cwd"],
): Promise<McpJsonRpcResponse> {
  const toolName = params?.name;
  if (typeof toolName !== "string") {
    return errorResponse(id, -32_602, "Tool name is required");
  }

  const entry = toolsByName.get(toolName);
  if (!entry) {
    return errorResponse(id, -32_602, `Unknown tool: '${toolName}'`);
  }

  const rawArgs = params?.arguments;
  const args =
    rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)
      ? (rawArgs as Record<string, unknown>)
      : {};

  const terminal = createMemoryTerminal({
    color: false,
    isTTY: false,
    unicode: true,
    columns: 100,
    env,
    cwd: cwd?.(),
  });

  const result = await run(serializeToolArgsToArgv(entry, args), { terminal });
  const text =
    [terminal.stdoutText(), terminal.stderrText()].filter(Boolean).join("\n") ||
    (result.ok ? "OK" : `Command failed with exit code ${result.exitCode}`);

  return okResponse(id, {
    content: [{ type: "text", text }],
    ...(result.ok ? {} : { isError: true }),
  });
}

async function handleResourcesRead(
  id: string | number | null,
  params: Record<string, unknown> | undefined,
  resourcesByUri: ReadonlyMap<string, ResourceEntry>,
  model: ReadonlyCliModel,
): Promise<McpJsonRpcResponse> {
  const uri = params?.uri;
  if (typeof uri !== "string") {
    return errorResponse(id, -32_602, "Resource URI is required");
  }

  const entry = resourcesByUri.get(uri);
  if (!entry) {
    return errorResponse(id, -32_602, `Unknown resource: '${uri}'`);
  }

  const node =
    entry.commandPath.length > 0
      ? model.tree.findNode(entry.commandPath)
      : model.tree.root;
  const text = await renderHelp(model, {
    node,
    theme: PLAIN_THEME,
    columns: 100,
  });

  return okResponse(id, {
    contents: [{ uri, mimeType: "text/plain", text }],
  });
}

export function createMcpHandler(
  options: CreateMcpHandlerOptions,
): McpRequestHandler {
  const {
    model,
    run,
    env,
    cwd,
    serverName = model.meta.scriptName || "clerc-cli",
    mcpCommandName = "mcp",
    resources: enableResources = true,
    filter,
  } = options;

  const filterOpts = { mcpCommandName, filter };
  const toolEntries = buildToolEntries(model, filterOpts);
  const toolsByName = new Map(toolEntries.map((e) => [e.tool.name, e]));

  const resourceEntries = enableResources
    ? buildResourceEntries(model, filterOpts)
    : [];
  const resourcesByUri = new Map(
    resourceEntries.map((e) => [e.resource.uri, e]),
  );

  return async (request) => {
    if (
      request.id === undefined ||
      request.method.startsWith("notifications/")
    ) {
      return null;
    }

    const id = request.id;

    try {
      switch (request.method) {
        case "initialize": {
          const clientVersion =
            typeof request.params?.protocolVersion === "string"
              ? request.params.protocolVersion
              : MCP_PROTOCOL_VERSION;

          return okResponse(id, {
            protocolVersion: clientVersion,
            capabilities: {
              tools: {},
              ...(enableResources ? { resources: {} } : {}),
            },
            serverInfo: {
              name: serverName,
              version: model.meta.version || "0.0.0",
            },
          });
        }

        case "ping": {
          return okResponse(id, {});
        }

        case "tools/list": {
          return okResponse(id, { tools: toolEntries.map((e) => e.tool) });
        }

        case "tools/call": {
          return handleToolsCall(
            id,
            request.params,
            toolsByName,
            run,
            env,
            cwd,
          );
        }

        case "resources/list": {
          return enableResources
            ? okResponse(id, {
                resources: resourceEntries.map((e) => e.resource),
              })
            : errorResponse(id, -32_601, "Resources are disabled");
        }

        case "resources/read": {
          return enableResources
            ? handleResourcesRead(id, request.params, resourcesByUri, model)
            : errorResponse(id, -32_601, "Resources are disabled");
        }

        default: {
          return errorResponse(
            id,
            -32_601,
            `Method not found: '${request.method}'`,
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return errorResponse(id, -32_603, message);
    }
  };
}

export async function serveMcpStdio(
  handler: McpRequestHandler,
  input: Readable = process.stdin,
  output: Writable = process.stdout,
): Promise<void> {
  const rl = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY });

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      output.write(
        `${JSON.stringify(errorResponse(null, -32_700, "Parse error"))}\n`,
      );

      continue;
    }

    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed as { jsonrpc?: unknown }).jsonrpc !== "2.0" ||
      typeof (parsed as { method?: unknown }).method !== "string"
    ) {
      const id =
        parsed && typeof parsed === "object" && "id" in parsed
          ? ((parsed as { id?: string | number | null }).id ?? null)
          : null;
      output.write(
        `${JSON.stringify(errorResponse(id, -32_600, "Invalid Request"))}\n`,
      );

      continue;
    }

    const response = await handler(parsed as McpJsonRpcRequest);
    if (response !== null) {
      output.write(`${JSON.stringify(response)}\n`);
    }
  }
}
