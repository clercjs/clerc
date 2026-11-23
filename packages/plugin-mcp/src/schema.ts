import type {
  AnyCommandDefinition,
  ClercFlagsDefinition,
  CommandNode,
  FlagKind,
  ReadonlyCliModel,
} from "@clerc/core";
import {
  DOUBLE_DASH,
  describeType,
  formatFlagName,
  kebabCase,
  normalizeFlagValue,
  resolveCommandArgs,
} from "@clerc/core";

export interface McpCommandMeta {
  readonly enabled?: boolean;
  readonly name?: string;
  readonly description?: string;
  readonly readOnly?: boolean;
  readonly destructive?: boolean;
  readonly idempotent?: boolean;
}

export interface McpToolAnnotations {
  readonly readOnlyHint?: boolean;
  readonly destructiveHint?: boolean;
  readonly idempotentHint?: boolean;
}

export interface McpToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: {
    readonly type: "object";
    readonly properties: Record<string, Record<string, unknown>>;
    readonly required?: readonly string[];
    readonly additionalProperties: false;
  };
  readonly annotations?: McpToolAnnotations;
}

interface ArgSlot {
  readonly name: string;
  readonly isVariadic: boolean;
}

interface FlagSlot {
  readonly kind: FlagKind;
  readonly negatable: boolean;
}

export interface McpToolEntry {
  readonly tool: McpToolDefinition;
  readonly commandPath: readonly string[];
  readonly mainArgs: readonly ArgSlot[];
  readonly doubleDashArgs: readonly ArgSlot[];
  readonly flags: ReadonlyMap<string, FlagSlot>;
}

export interface McpFilterOptions {
  readonly mcpCommandName?: string;
  readonly filter?: (commandPath: readonly string[]) => boolean;
}

const getMcpMeta = (
  meta?: Record<string, unknown>,
): McpCommandMeta | undefined => meta?.mcp as McpCommandMeta | undefined;

const isJsonPrimitive = (value: unknown): boolean =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean" ||
  value === null;

const sanitizeToolName = (raw: string): string =>
  raw.replace(/[^\w-]/g, "_").replace(/^_+|_+$/g, "") || "run";

function buildAnnotations(
  mcpMeta?: McpCommandMeta,
): McpToolAnnotations | undefined {
  if (!mcpMeta) {
    return undefined;
  }
  const annotations: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
  } = {};
  if (mcpMeta.readOnly !== undefined) {
    annotations.readOnlyHint = mcpMeta.readOnly;
  }
  if (mcpMeta.destructive !== undefined) {
    annotations.destructiveHint = mcpMeta.destructive;
  }
  if (mcpMeta.idempotent !== undefined) {
    annotations.idempotentHint = mcpMeta.idempotent;
  }

  return Object.keys(annotations).length > 0 ? annotations : undefined;
}

/**
 * Shared command selection rule used by both MCP tool registration and MCP help
 * resource registration.
 */
export function listExposedCommands(
  model: ReadonlyCliModel,
  options: McpFilterOptions = {},
): readonly {
  readonly node: CommandNode;
  readonly command: AnyCommandDefinition;
}[] {
  const { mcpCommandName = "mcp", filter } = options;
  const exposed: {
    readonly node: CommandNode;
    readonly command: AnyCommandDefinition;
  }[] = [];

  for (const node of model.tree.walkCommands()) {
    const cmd = node.command;
    if (!cmd) {
      continue;
    }

    const mcpMeta = getMcpMeta(cmd.meta);
    if (mcpMeta?.enabled === false) {
      continue;
    }

    const isMcpCommand =
      node.fullPath.length === 1 && node.fullPath[0] === mcpCommandName;
    if (
      mcpMeta?.enabled !== true &&
      (cmd.hidden || cmd.builtin || isMcpCommand)
    ) {
      continue;
    }

    if (filter && !filter(node.fullPath)) {
      continue;
    }

    exposed.push({ node, command: cmd });
  }

  return exposed;
}

function buildToolEntry(
  node: CommandNode,
  cmd: AnyCommandDefinition,
  model: ReadonlyCliModel,
): McpToolEntry {
  const mcpMeta = getMcpMeta(cmd.meta);
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];
  const mainArgs: ArgSlot[] = [];
  const doubleDashArgs: ArgSlot[] = [];

  for (const arg of resolveCommandArgs(cmd)) {
    const slot: ArgSlot = { name: arg.name, isVariadic: arg.isVariadic };
    (arg.afterDoubleDash ? doubleDashArgs : mainArgs).push(slot);

    const itemSchema = arg.options.type
      ? describeType(arg.options.type).toJsonSchema()
      : { type: "string" };
    const prop: Record<string, unknown> = arg.isVariadic
      ? { type: "array", items: itemSchema }
      : itemSchema;

    if (arg.options.description) {
      prop.description = arg.options.description;
    }
    properties[arg.name] = prop;

    if (arg.isRequired) {
      required.push(arg.name);
    }
  }

  const mergedFlags: ClercFlagsDefinition = {
    ...model.globalFlags,
    ...cmd.flags,
  };
  const flags = new Map<string, FlagSlot>();

  for (const [name, rawDef] of Object.entries(mergedFlags)) {
    const norm = normalizeFlagValue(rawDef);
    if (norm.hidden || norm.builtin || name in properties) {
      continue;
    }

    const desc = describeType(norm.type);
    const schema = desc.toJsonSchema();
    if (norm.description) {
      schema.description = norm.description;
    }
    if (norm.default !== undefined && isJsonPrimitive(norm.default)) {
      schema.default = norm.default;
    }

    properties[name] = schema;
    if (norm.required && !norm.env) {
      required.push(name);
    }
    flags.set(name, {
      kind: desc.kind,
      negatable: norm.negatable !== false,
    });
  }

  const baseName =
    mcpMeta?.name ??
    (node.fullPath.length > 0
      ? node.fullPath.join("_")
      : model.meta.scriptName);
  const description =
    mcpMeta?.description ??
    cmd.description ??
    `Run '${[model.meta.scriptName, ...node.fullPath].filter(Boolean).join(" ")}'`;
  const annotations = buildAnnotations(mcpMeta);

  return {
    tool: {
      name: sanitizeToolName(baseName),
      description,
      inputSchema: {
        type: "object",
        properties,
        ...(required.length > 0 ? { required } : {}),
        additionalProperties: false,
      },
      ...(annotations ? { annotations } : {}),
    },
    commandPath: node.fullPath,
    mainArgs,
    doubleDashArgs,
    flags,
  };
}

export function buildToolEntries(
  model: ReadonlyCliModel,
  options?: McpFilterOptions,
): readonly McpToolEntry[] {
  const entries = listExposedCommands(model, options)
    .filter(({ command }) => Boolean(command.run))
    .map(({ node, command }) => buildToolEntry(node, command, model));

  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.tool.name)) {
      throw new Error(`Duplicate MCP tool name: '${entry.tool.name}'`);
    }
    seen.add(entry.tool.name);
  }

  return entries;
}

function appendPositionals(
  target: string[],
  slots: readonly ArgSlot[],
  input: Readonly<Record<string, unknown>>,
): void {
  for (const arg of slots) {
    const value = input[arg.name];
    if (value === undefined) {
      continue;
    }
    if (arg.isVariadic && Array.isArray(value)) {
      for (const item of value) {
        target.push(String(item));
      }
    } else {
      target.push(String(value));
    }
  }
}

export function serializeToolArgsToArgv(
  entry: McpToolEntry,
  input: Readonly<Record<string, unknown>> = {},
): string[] {
  const argv: string[] = [...entry.commandPath];

  for (const [name, info] of entry.flags) {
    const value = input[name];
    if (value === undefined) {
      continue;
    }

    const flagName = formatFlagName(name);
    switch (info.kind) {
      case "boolean": {
        if (value === true) {
          argv.push(flagName);
        } else if (value === false && info.negatable) {
          argv.push(`--no-${kebabCase(name)}`);
        }

        break;
      }
      case "counter": {
        const count = Math.max(0, Math.floor(Number(value) || 0));
        for (let i = 0; i < count; i++) {
          argv.push(flagName);
        }

        break;
      }
      case "array": {
        if (Array.isArray(value)) {
          for (const item of value) {
            argv.push(flagName, String(item));
          }
        }

        break;
      }
      case "single": {
        argv.push(flagName, String(value));

        break;
      }
    }
  }

  const mainValues: string[] = [];
  appendPositionals(mainValues, entry.mainArgs, input);

  const ddValues: string[] = [];
  appendPositionals(ddValues, entry.doubleDashArgs, input);

  if (
    entry.doubleDashArgs.length === 0 &&
    mainValues.some((v) => v.startsWith("-"))
  ) {
    argv.push(DOUBLE_DASH, ...mainValues);
  } else {
    argv.push(...mainValues);
    if (ddValues.length > 0) {
      argv.push(DOUBLE_DASH, ...ddValues);
    }
  }

  return argv;
}
