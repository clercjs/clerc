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
    const handler: ArgumentHandler | undefined =
      arg.meta?.completions?.handler ?? createEnumCompleter(arg.toJsonSchema);
    tc.argument(arg.name, handler, arg.isVariadic);
  }
}

function populateCommandSurface(tabCmd: TabCommand, node: CommandNode): void {
  node.command?.meta?.completions?.handler?.(tabCmd);
  registerNodeArgs(node.args, tabCmd);
  registerFlagList(node.localFlags, tabCmd);
}

function populateSubcommand(
  tabCmd: TabCommand,
  node: CommandNode,
  model: CliModel,
  localNames: ReadonlySet<string>,
): void {
  registerFlagList(model.globalFlags, tabCmd, localNames);
  registerFlagList(node.builtinFlags, tabCmd);
  populateCommandSurface(tabCmd, node);
}

export function buildTabModel(root: RootCommand, model: CliModel): void {
  const defaultNode =
    !model.tree.root.command && model.defaultCommand
      ? model.tree.findNode(model.defaultCommand)
      : undefined;
  const rootTarget = defaultNode ?? model.tree.root;
  const rootLocalNames = new Set(rootTarget.localFlags.map((f) => f.name));

  registerFlagList(model.globalFlags, root, rootLocalNames);
  registerFlagList(model.tree.root.builtinFlags, root);

  if (
    rootTarget.command &&
    !rootTarget.command.hidden &&
    rootTarget.command.meta?.completions?.show !== false
  ) {
    populateCommandSurface(root, rootTarget);
  }

  for (const node of model.tree.walkCommands()) {
    const cmd = node.command;
    const compMeta = cmd.meta?.completions;
    if (node.fullPath.length === 0 || cmd.hidden || compMeta?.show === false) {
      continue;
    }

    const fullName = node.fullPath.join(" ");
    const localNames = new Set(node.localFlags.map((f) => f.name));
    const tabCmd = root.command(fullName, cmd.description ?? "");
    populateSubcommand(tabCmd, node, model, localNames);

    const parentPrefix = node.fullPath.slice(0, -1);
    for (const alias of node.aliases) {
      const aliasFullName = alias.includes(" ")
        ? alias
        : [...parentPrefix, alias].join(" ");
      const aliasCmd = root.command(aliasFullName, cmd.description ?? "");
      populateSubcommand(aliasCmd, node, model, localNames);
    }
  }
}
