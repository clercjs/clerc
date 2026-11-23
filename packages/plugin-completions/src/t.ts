import type {
  ArgumentHandler,
  Command as TabCommand,
  Complete,
  OptionHandler,
  RootCommand,
} from "@bomb.sh/tab";
import type {
  ArgDescriptor,
  CliModel,
  CommandNode,
  FlagDescriptor,
} from "clerc";

export interface CommandCompletionMeta {
  readonly show?: boolean;
  readonly handler?: (command: TabCommand) => void;
}

export interface FlagCompletionMeta {
  readonly show?: boolean;
  readonly handler?: OptionHandler;
}

export interface ArgCompletionMeta {
  readonly show?: boolean;
  readonly handler?: ArgumentHandler;
}

export type CompletionMeta =
  CommandCompletionMeta | FlagCompletionMeta | ArgCompletionMeta;

function createEnumCompleter(
  toJsonSchema: () => Record<string, unknown>,
): ((complete: Complete) => void) | undefined {
  const rawEnum = toJsonSchema().enum;
  if (!Array.isArray(rawEnum) || rawEnum.length === 0) {
    return undefined;
  }
  const values = rawEnum.map(String);

  return (complete) => {
    for (const val of values) {
      complete(val, "");
    }
  };
}

function registerFlagDescriptor(tc: TabCommand, flag: FlagDescriptor): void {
  const compMeta = flag.meta?.completions;
  if (flag.hidden || compMeta?.show === false) {
    return;
  }

  const longName = flag.target.slice(2);
  const desc = flag.description ?? "";
  if (flag.kind === "boolean" || flag.kind === "counter") {
    tc.option(longName, desc, flag.short);
    for (const alias of flag.aliases) {
      tc.option(alias, desc);
    }
  } else {
    const handler: OptionHandler =
      compMeta?.handler ??
      createEnumCompleter(flag.toJsonSchema) ??
      (async () => {});
    tc.option(longName, desc, handler, flag.short);
    for (const alias of flag.aliases) {
      tc.option(alias, desc, handler);
    }
  }
}

function registerFlagList(
  flags: readonly FlagDescriptor[],
  tc: TabCommand,
  skipNames?: ReadonlySet<string>,
): void {
  for (const flag of flags) {
    if (skipNames?.has(flag.name)) {
      continue;
    }
    registerFlagDescriptor(tc, flag);
  }
}

function registerNodeArgs(
  args: readonly ArgDescriptor[],
  tc: TabCommand,
): void {
  for (const arg of args) {
    const argComp = arg.meta?.completions;
    const handler: ArgumentHandler | undefined =
      argComp?.handler ?? createEnumCompleter(arg.toJsonSchema);
    tc.argument(arg.name, handler, arg.isVariadic);
  }
}

function populateSubcommand(
  tabCmd: TabCommand,
  node: CommandNode,
  model: CliModel,
  localNames: ReadonlySet<string>,
): void {
  registerFlagList(model.globalFlags, tabCmd, localNames);
  registerFlagList(node.builtinFlags, tabCmd);
  node.command?.meta?.completions?.handler?.(tabCmd);
  registerNodeArgs(node.args, tabCmd);
  registerFlagList(node.localFlags, tabCmd);
}

export function buildTabModel(t: RootCommand, model: CliModel): void {
  const defaultNode =
    !model.tree.root.command && model.defaultCommand
      ? model.tree.findNode(model.defaultCommand)
      : undefined;
  const rootTarget = defaultNode ?? model.tree.root;
  const rootLocalNames = new Set(rootTarget.localFlags.map((f) => f.name));

  registerFlagList(model.globalFlags, t, rootLocalNames);
  registerFlagList(model.tree.root.builtinFlags, t);

  if (defaultNode && !defaultNode.command?.hidden) {
    const defaultComp = defaultNode.command?.meta?.completions;
    if (defaultComp?.show !== false) {
      defaultComp?.handler?.(t);
      registerNodeArgs(defaultNode.args, t);
      registerFlagList(defaultNode.localFlags, t);
    }
  }

  const commands: readonly CommandNode[] = model.tree.walkCommands();
  for (const node of commands) {
    const cmd = node.command;
    if (!cmd) {
      continue;
    }

    const compMeta = cmd.meta?.completions;
    if (cmd.hidden || compMeta?.show === false) {
      continue;
    }

    const fullName = node.fullPath.join(" ");
    const localNames = new Set(node.localFlags.map((f) => f.name));

    if (fullName === "") {
      compMeta?.handler?.(t);
      registerNodeArgs(node.args, t);
      registerFlagList(node.localFlags, t);

      continue;
    }

    const tabCmd = t.command(fullName, cmd.description ?? "");
    populateSubcommand(tabCmd, node, model, localNames);

    const rawAliases = cmd.aliases
      ? Array.isArray(cmd.aliases)
        ? cmd.aliases
        : [cmd.aliases]
      : [];
    const parentPrefix = node.fullPath.slice(0, -1);
    for (const rawAlias of rawAliases) {
      const trimmed = rawAlias.trim();
      const aliasFullName = trimmed.includes(" ")
        ? trimmed
        : [...parentPrefix, trimmed].join(" ");
      const aliasCmd = t.command(aliasFullName, cmd.description ?? "");
      populateSubcommand(aliasCmd, node, model, localNames);
    }
  }
}
