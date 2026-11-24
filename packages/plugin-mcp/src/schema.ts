import type {
  AnyCommandDefinition,
  CliModel,
  CommandNode,
  FlagKind,
  RuleDescriptor,
  RuleRef,
} from "clerc";

const DOUBLE_DASH = "--";

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
    readonly dependentRequired?: Readonly<Record<string, readonly string[]>>;
    readonly allOf?: readonly Record<string, unknown>[];
    readonly additionalProperties: false;
  };
  readonly annotations?: McpToolAnnotations;
}

interface ArgSlot {
  readonly name: string;
  readonly isVariadic: boolean;
}

interface FlagSlot {
  readonly target: string;
  readonly kind: FlagKind;
  readonly negatable: boolean;
}

export interface McpToolEntry {
  readonly tool: McpToolDefinition;
  readonly commandPath: readonly string[];
  readonly mainArgs: readonly ArgSlot[];
  readonly doubleDashArgs: readonly ArgSlot[];
  readonly flags: ReadonlyMap<string, FlagSlot>;
  readonly rootSubcommands?: ReadonlySet<string>;
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

export function listExposedCommands(
  model: CliModel,
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

    const mcpMeta = getMcpMeta(cmd.meta);
    if (mcpMeta?.enabled === false) {
      continue;
    }

    const isMcpCommand =
      node.fullPath.length === 1 && node.fullPath[0] === mcpCommandName;
    if (
      mcpMeta?.enabled !== true &&
      (cmd.hidden || cmd.standalone || isMcpCommand)
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
  model: CliModel,
): McpToolEntry {
  const mcpMeta = getMcpMeta(cmd.meta);
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];
  const mainArgs: ArgSlot[] = [];
  const doubleDashArgs: ArgSlot[] = [];

  for (const arg of node.args) {
    const slot: ArgSlot = { name: arg.name, isVariadic: arg.isVariadic };
    (arg.afterDoubleDash ? doubleDashArgs : mainArgs).push(slot);

    const itemSchema = { ...arg.toJsonSchema() };
    const prop: Record<string, unknown> = arg.isVariadic
      ? { type: "array", items: itemSchema }
      : itemSchema;

    if (arg.description) {
      prop.description = arg.description;
    }
    if (arg.default !== undefined && isJsonPrimitive(arg.default)) {
      prop.default = arg.default;
    }
    properties[arg.name] = prop;

    if (arg.isRequired && !arg.env) {
      required.push(arg.name);
    }
  }

  const localNames = new Set(node.localFlags.map((f) => f.name));
  const mergedFlags = [
    ...model.globalFlags.filter((f) => !localNames.has(f.name)),
    ...node.localFlags,
  ];
  const flags = new Map<string, FlagSlot>();

  for (const flag of mergedFlags) {
    if (flag.hidden || flag.name in properties) {
      continue;
    }

    const schema = { ...flag.toJsonSchema() };
    if (flag.description) {
      schema.description = flag.description;
    }
    if (flag.default !== undefined && isJsonPrimitive(flag.default)) {
      schema.default = flag.default;
    }

    properties[flag.name] = schema;
    if (flag.required && !flag.env) {
      required.push(flag.name);
    }
    flags.set(flag.name, {
      target: flag.target,
      kind: flag.kind,
      negatable: flag.negatable,
    });
  }

  const isStandalone = Boolean(cmd.standalone);
  const activeRules: readonly RuleDescriptor[] = isStandalone
    ? node.rules
    : [...model.globalRules, ...node.rules];
  const argNames = new Set(node.args.map((a) => a.name));

  function resolveMcpProp(ref: RuleRef): string | undefined {
    if (ref.kind === "arg") {
      return ref.name in properties ? ref.name : undefined;
    }
    // Skip flags shadowed by a same-named positional arg in MCP's flat properties
    if (argNames.has(ref.name)) {
      return undefined;
    }

    return flags.has(ref.name) ? ref.name : undefined;
  }

  const dependentRequired: Record<string, string[]> = {};
  const allOf: Record<string, unknown>[] = [];

  function addDep(src: string, dep: string): void {
    if (src === dep) {
      return;
    }
    const list = (dependentRequired[src] ??= []);
    if (!list.includes(dep)) {
      list.push(dep);
    }
  }

  for (const rule of activeRules) {
    if (rule.kind === "requires") {
      const src = resolveMcpProp(rule.source);
      if (!src) {
        continue;
      }
      for (const target of rule.targets) {
        const dep = resolveMcpProp(target);
        if (dep) {
          addDep(src, dep);
        }
      }

      continue;
    }

    const props = rule.targets
      .map(resolveMcpProp)
      .filter((p): p is string => Boolean(p));
    if (props.length < 2) {
      continue;
    }

    if (rule.kind === "together") {
      for (const a of props) {
        for (const b of props) {
          addDep(a, b);
        }
      }
    } else if (rule.kind === "atLeastOne") {
      allOf.push({ anyOf: props.map((p) => ({ required: [p] })) });
    } else if (rule.kind === "exclusive" || rule.kind === "oneOf") {
      if (rule.kind === "oneOf") {
        allOf.push({ anyOf: props.map((p) => ({ required: [p] })) });
      }
      for (let i = 0; i < props.length; i++) {
        for (let j = i + 1; j < props.length; j++) {
          allOf.push({ not: { required: [props[i], props[j]] } });
        }
      }
    }
  }

  const hasDepReq = Object.keys(dependentRequired).length > 0;

  const baseName =
    mcpMeta?.name ??
    (node.fullPath.length > 0 ? node.fullPath.join("_") : model.meta.name);
  const description =
    mcpMeta?.description ??
    cmd.description ??
    `Run '${[model.meta.name, ...node.fullPath].filter(Boolean).join(" ")}'`;
  const annotations = buildAnnotations(mcpMeta);

  return {
    tool: {
      name: sanitizeToolName(baseName),
      description,
      inputSchema: {
        type: "object",
        properties,
        ...(required.length > 0 ? { required } : {}),
        ...(hasDepReq ? { dependentRequired } : {}),
        ...(allOf.length > 0 ? { allOf } : {}),
        additionalProperties: false,
      },
      ...(annotations ? { annotations } : {}),
    },
    commandPath: node.fullPath,
    mainArgs,
    doubleDashArgs,
    flags,
    rootSubcommands:
      node.fullPath.length === 0
        ? new Set([
            ...model.tree.root.children.keys(),
            ...model.tree.root.aliasIndex.keys(),
          ])
        : undefined,
  };
}

export function buildToolEntries(
  model: CliModel,
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

    switch (info.kind) {
      case "boolean": {
        if (value === true) {
          argv.push(info.target);
        } else if (value === false) {
          argv.push(
            info.negatable
              ? `--no-${info.target.slice(2)}`
              : `${info.target}=false`,
          );
        }

        break;
      }
      case "counter": {
        const count = Math.max(0, Math.floor(Number(value) || 0));
        for (let i = 0; i < count; i++) {
          argv.push(info.target);
        }

        break;
      }
      case "array": {
        if (Array.isArray(value)) {
          for (const item of value) {
            argv.push(`${info.target}=${String(item)}`);
          }
        }

        break;
      }
      case "single": {
        argv.push(`${info.target}=${String(value)}`);

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
    (mainValues.some((v) => v.startsWith("-")) ||
      (mainValues.length > 0 && entry.rootSubcommands?.has(mainValues[0])))
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
