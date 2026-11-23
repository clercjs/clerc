import type { Command as TabCommand, RootCommand } from "@bomb.sh/tab";
import type {
  ClercFlagDefinitionValue,
  ClercFlagsDefinition,
  CommandNode,
  ReadonlyCliModel,
} from "@clerc/core";
import {
  DOUBLE_DASH,
  extractArgInfo,
  normalizeArgValue,
  normalizeFlagValue,
} from "@clerc/core";

export interface CompletionMeta {
  readonly show?: boolean;
  readonly handler?: (...args: any[]) => any;
}

const getCompletionMeta = (
  meta?: Record<string, unknown>,
): CompletionMeta | undefined =>
  meta?.completions as CompletionMeta | undefined;

function registerFlag(
  tc: TabCommand,
  flagName: string,
  def: ClercFlagDefinitionValue,
): void {
  const normalized = normalizeFlagValue(def);
  const compMeta = getCompletionMeta(normalized.meta);
  if (normalized.hidden || compMeta?.show === false) {
    return;
  }

  const desc = normalized.description ?? "";
  if (normalized.type === Boolean) {
    tc.option(flagName, desc, normalized.short);
  } else {
    const handler = compMeta?.handler ?? (async () => {});
    tc.option(flagName, desc, handler, normalized.short);
  }
}

function registerGlobalFlags(
  globalFlags: Readonly<ClercFlagsDefinition>,
  tc: TabCommand,
): void {
  for (const [flagName, def] of Object.entries(globalFlags)) {
    registerFlag(tc, flagName, def);
  }
}

export function buildTabModel(t: RootCommand, model: ReadonlyCliModel): void {
  registerGlobalFlags(model.globalFlags, t);

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

    if (fullName !== "") {
      tabCmd = t.command(fullName, cmd.description ?? "");
      registerGlobalFlags(model.globalFlags, tabCmd);
    }

    compMeta?.handler?.(tabCmd);

    for (const token of cmd.argTokens) {
      if (token === DOUBLE_DASH) {
        continue;
      }
      const { name, isVariadic } = extractArgInfo(token);
      const rawDef = cmd.args?.[name];
      const norm = rawDef ? normalizeArgValue(rawDef) : undefined;
      const argComp = getCompletionMeta(norm?.meta);
      tabCmd.argument(name, argComp?.handler, isVariadic);
    }

    for (const [flagName, def] of Object.entries(cmd.flags ?? {})) {
      registerFlag(tabCmd, flagName, def as ClercFlagDefinitionValue);
    }
  }
}
