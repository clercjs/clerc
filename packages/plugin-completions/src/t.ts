import type { Command as TabCommand, RootCommand } from "@bomb.sh/tab";
import type { CommandNode, FlagDescriptor, ReadonlyCliModel } from "clerc";

export interface CompletionMeta {
  readonly show?: boolean;
  readonly handler?: (...args: any[]) => any;
}

const getCompletionMeta = (
  meta?: Record<string, unknown>,
): CompletionMeta | undefined =>
  meta?.completions as CompletionMeta | undefined;

function registerFlagDescriptor(tc: TabCommand, flag: FlagDescriptor): void {
  const compMeta = getCompletionMeta(flag.meta);
  if (flag.hidden || compMeta?.show === false) {
    return;
  }

  const desc = flag.description ?? "";
  if (flag.kind === "boolean" || flag.kind === "counter") {
    tc.option(flag.name, desc, flag.short);
    for (const alias of flag.aliases) {
      tc.option(alias, desc);
    }
  } else {
    const handler = compMeta?.handler ?? (async () => {});
    tc.option(flag.name, desc, handler, flag.short);
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

export function buildTabModel(t: RootCommand, model: ReadonlyCliModel): void {
  registerFlagList(model.globalFlags, t);
  registerFlagList(model.tree.root.builtinFlags, t);

  const commands: readonly CommandNode[] = model.tree.walkCommands();
  for (const node of commands) {
    const cmd = node.command;
    if (!cmd) {
      continue;
    }

    const compMeta = getCompletionMeta(cmd.meta);
    if (cmd.hidden || compMeta?.show === false) {
      continue;
    }

    const fullName = node.fullPath.join(" ");
    let tabCmd: TabCommand = t;
    const localNames = new Set(node.localFlags.map((f) => f.name));

    if (fullName !== "") {
      tabCmd = t.command(fullName, cmd.description ?? "");
      registerFlagList(model.globalFlags, tabCmd, localNames);
      registerFlagList(node.builtinFlags, tabCmd);
    }

    compMeta?.handler?.(tabCmd);

    for (const arg of node.args) {
      const argComp = getCompletionMeta(arg.meta);
      tabCmd.argument(arg.name, argComp?.handler, arg.isVariadic);
    }

    registerFlagList(node.localFlags, tabCmd);
  }
}
