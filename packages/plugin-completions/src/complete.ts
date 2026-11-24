import type {
  ArgDescriptor,
  CliModel,
  CommandNode,
  CompletionCandidate,
  CompletionContext,
  CompletionItem,
  CompletionResult,
  FlagDescriptor,
  Terminal,
} from "clerc";
import { createMemoryTerminal } from "clerc";

import { ShellCompDirective } from "./shells";

export interface ResolvedCompletions {
  readonly candidates: readonly CompletionCandidate[];
  readonly directive: number;
}

export interface ResolveCompletionsOptions {
  readonly terminal?: Terminal;
}

const DOUBLE_DASH = "--";

const toCandidate = (item: CompletionItem): CompletionCandidate =>
  typeof item === "string"
    ? { value: item }
    : { value: item.value, description: item.description };

function extractEnumCandidates(
  toJsonSchema: () => Record<string, unknown>,
): readonly CompletionCandidate[] | undefined {
  const schema = toJsonSchema();
  const rawEnum =
    schema.enum ??
    (typeof schema.items === "object" && schema.items !== null
      ? (schema.items as Record<string, unknown>).enum
      : undefined);

  if (!Array.isArray(rawEnum) || rawEnum.length === 0) {
    return undefined;
  }

  return rawEnum.map((val) => ({ value: String(val) }));
}

function getScopeFlags(
  node: CommandNode,
  model: CliModel,
  includeBuiltins: boolean,
): readonly FlagDescriptor[] {
  const isStandalone =
    Boolean(node.command?.standalone) || Boolean(node.command?.builtin);
  const localNames = new Set(node.localFlags.map((f) => f.name));

  return [
    ...(isStandalone
      ? []
      : model.globalFlags.filter((f) => !localNames.has(f.name))),
    ...node.localFlags,
    ...(includeBuiltins ? node.builtinFlags : []),
  ];
}

function findLongFlag(
  flags: readonly FlagDescriptor[],
  rawBody: string,
): { readonly flag: FlagDescriptor; readonly negated: boolean } | undefined {
  for (const flag of flags) {
    const kebab = flag.target.slice(2);
    if (
      flag.name === rawBody ||
      kebab === rawBody ||
      flag.aliases.includes(rawBody)
    ) {
      return { flag, negated: false };
    }
    if (
      flag.kind === "boolean" &&
      flag.negatable &&
      rawBody === `no-${kebab}`
    ) {
      return { flag, negated: true };
    }
  }

  return undefined;
}

const findShortFlag = (
  flags: readonly FlagDescriptor[],
  ch: string,
): FlagDescriptor | undefined => flags.find((f) => f.short === ch);

function recordFlagValue(
  store: Record<string, unknown>,
  flag: FlagDescriptor,
  value: unknown,
): void {
  if (flag.kind === "array") {
    const strVal = String(value);
    const items = flag.delimiter ? strVal.split(flag.delimiter) : [strVal];
    const list = (store[flag.name] as unknown[] | undefined) ?? [];
    list.push(...items);
    store[flag.name] = list;
  } else {
    store[flag.name] = value;
  }
}

function applyFlagDefaults(
  flags: readonly FlagDescriptor[],
  rawValues: Readonly<Record<string, unknown>>,
  env: Readonly<Record<string, string | undefined>>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = { ...rawValues };
  for (const flag of flags) {
    if (flag.name in resolved) {
      continue;
    }
    const envVal = flag.env ? env[flag.env] : undefined;
    if (envVal !== undefined && envVal !== "") {
      resolved[flag.name] =
        flag.kind === "boolean"
          ? envVal !== "false" && envVal !== "0"
          : flag.kind === "counter"
            ? Number(envVal) || 0
            : flag.kind === "array"
              ? envVal.split(flag.delimiter ?? ",")
              : envVal;

      continue;
    }
    if (flag.default !== undefined) {
      resolved[flag.name] =
        typeof flag.default === "function"
          ? (flag.default as () => unknown)()
          : flag.default;
    } else if (flag.kind === "boolean") {
      resolved[flag.name] = false;
    } else if (flag.kind === "counter") {
      resolved[flag.name] = 0;
    } else if (flag.kind === "array") {
      resolved[flag.name] = [];
    }
  }

  return resolved;
}

function buildPartialArgs(
  args: readonly ArgDescriptor[],
  words: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [idx, arg] of args.entries()) {
    if (arg.isVariadic) {
      if (idx < words.length) {
        out[arg.name] = words.slice(idx);
      }

      break;
    }
    if (idx < words.length) {
      out[arg.name] = words[idx];
    }
  }

  return out;
}

function normalizeResult(
  result: CompletionResult,
  current: string,
): ResolvedCompletions {
  if (!result) {
    return { candidates: [], directive: ShellCompDirective.NoFileComp };
  }
  if (Array.isArray(result)) {
    return {
      candidates: filterAndDedupe(result.map(toCandidate), current),
      directive: ShellCompDirective.NoFileComp,
    };
  }

  const obj = result as Exclude<
    CompletionResult,
    readonly CompletionItem[] | void
  >;
  let directive: number = ShellCompDirective.NoFileComp;
  let skipPrefixFilter = false;
  let candidates = (obj.items ?? []).map(toCandidate);

  if (Array.isArray(obj.files)) {
    directive = ShellCompDirective.FilterFileExt;
    skipPrefixFilter = true;
    candidates = obj.files.map((ext) => ({ value: ext.replace(/^\./, "") }));
  } else if (obj.files === "dirs") {
    directive = ShellCompDirective.FilterDirs;
    skipPrefixFilter = true;
  } else if (obj.files === true) {
    directive = ShellCompDirective.Default;
  }

  if (obj.noSpace) {
    directive |= ShellCompDirective.NoSpace;
  }
  if (obj.keepOrder) {
    directive |= ShellCompDirective.KeepOrder;
  }

  return {
    candidates: skipPrefixFilter
      ? candidates
      : filterAndDedupe(candidates, current),
    directive,
  };
}

function filterAndDedupe(
  items: readonly CompletionCandidate[],
  prefix: string,
): readonly CompletionCandidate[] {
  const seen = new Set<string>();
  const filtered: CompletionCandidate[] = [];
  for (const item of items) {
    if (!item.value.startsWith(prefix) || seen.has(item.value)) {
      continue;
    }
    seen.add(item.value);
    filtered.push(item);
  }

  return filtered;
}

async function completeFlagValue(
  flag: FlagDescriptor,
  baseCtx: CompletionContext,
): Promise<ResolvedCompletions> {
  if (flag.complete === false || flag.hidden) {
    return { candidates: [], directive: ShellCompDirective.NoFileComp };
  }

  let headPrefix = "";
  let itemCurrent = baseCtx.current;
  let alreadyPicked: ReadonlySet<string> | undefined;

  if (
    flag.kind === "array" &&
    flag.delimiter &&
    baseCtx.current.includes(flag.delimiter)
  ) {
    const lastIdx = baseCtx.current.lastIndexOf(flag.delimiter);
    headPrefix = baseCtx.current.slice(0, lastIdx + flag.delimiter.length);
    itemCurrent = baseCtx.current.slice(lastIdx + flag.delimiter.length);
    alreadyPicked = new Set(
      baseCtx.current.slice(0, lastIdx).split(flag.delimiter),
    );
  }

  const itemCtx: CompletionContext =
    itemCurrent === baseCtx.current
      ? baseCtx
      : { ...baseCtx, current: itemCurrent };

  let resolved: ResolvedCompletions;
  if (typeof flag.complete === "function") {
    resolved = normalizeResult(await flag.complete(itemCtx), itemCurrent);
  } else {
    const enums = extractEnumCandidates(flag.toJsonSchema);
    resolved = enums
      ? {
          candidates: filterAndDedupe(enums, itemCurrent),
          directive: ShellCompDirective.NoFileComp,
        }
      : { candidates: [], directive: ShellCompDirective.NoFileComp };
  }

  if (!headPrefix) {
    return resolved;
  }

  return {
    directive: resolved.directive,
    candidates: resolved.candidates
      .filter((c) => !alreadyPicked?.has(c.value))
      .map((c) => ({
        value: `${headPrefix}${c.value}`,
        description: c.description,
      })),
  };
}

function matchInlineFlagValue(
  flags: readonly FlagDescriptor[],
  rawCurrent: string,
): { readonly flag: FlagDescriptor; readonly valuePart: string } | undefined {
  const eq = rawCurrent.indexOf("=");
  if (eq === -1) {
    return undefined;
  }
  if (rawCurrent.startsWith("--") && eq > 2) {
    const hit = findLongFlag(flags, rawCurrent.slice(2, eq));
    if (
      hit &&
      !hit.negated &&
      hit.flag.kind !== "boolean" &&
      hit.flag.kind !== "counter"
    ) {
      return { flag: hit.flag, valuePart: rawCurrent.slice(eq + 1) };
    }

    return undefined;
  }
  if (rawCurrent.startsWith("-") && !rawCurrent.startsWith("--") && eq >= 2) {
    const flag = findShortFlag(flags, rawCurrent[eq - 1]);
    if (flag && flag.kind !== "boolean" && flag.kind !== "counter") {
      return { flag, valuePart: rawCurrent.slice(eq + 1) };
    }
  }

  return undefined;
}

function completeFlagNames(
  flags: readonly FlagDescriptor[],
  current: string,
): ResolvedCompletions {
  const isShortOnly =
    current.startsWith("-") && !current.startsWith("--") && current.length > 1;
  const showAllNegated = current.startsWith("--no");
  const items: CompletionCandidate[] = [];

  for (const flag of flags) {
    if (flag.hidden || flag.complete === false) {
      continue;
    }
    const desc = flag.description ?? "";
    if (!isShortOnly) {
      items.push({ value: flag.target, description: desc });
      for (const alias of flag.aliases) {
        items.push({ value: `--${alias}`, description: desc });
      }
      if (
        flag.kind === "boolean" &&
        flag.negatable &&
        (flag.default === true || showAllNegated)
      ) {
        items.push({
          value: `--no-${flag.target.slice(2)}`,
          description: desc,
        });
      }
    }
    if (!current.startsWith("--") && flag.short) {
      items.push({ value: `-${flag.short}`, description: desc });
    }
  }

  return {
    candidates: filterAndDedupe(items, current),
    directive: ShellCompDirective.NoFileComp,
  };
}

export async function resolveCompletions(
  model: CliModel,
  input: readonly string[],
  options: ResolveCompletionsOptions = {},
): Promise<ResolvedCompletions> {
  const terminal = options.terminal ?? createMemoryTerminal();
  const priorTokens = input.length > 0 ? input.slice(0, -1) : [];
  const rawCurrent = input.at(-1) ?? "";

  let node: CommandNode = model.tree.root;
  let inSubcommandSearch = true;
  let afterDoubleDash = false;
  const words: string[] = [];
  const doubleDashWords: string[] = [];
  const rawFlagValues: Record<string, unknown> = {};
  let pendingFlag: FlagDescriptor | undefined;

  for (let i = 0; i < priorTokens.length; i++) {
    const tok = priorTokens[i];
    if (afterDoubleDash) {
      doubleDashWords.push(tok);

      continue;
    }
    if (tok === DOUBLE_DASH) {
      inSubcommandSearch = false;
      afterDoubleDash = true;

      continue;
    }
    if (node.command?.stopAtFirstPositional && words.length > 0) {
      words.push(tok);

      continue;
    }

    const scopeFlags = getScopeFlags(node, model, true);

    if (tok.startsWith("--") && tok.length > 2) {
      const eq = tok.indexOf("=");
      const rawName = eq === -1 ? tok.slice(2) : tok.slice(2, eq);
      const hit = findLongFlag(scopeFlags, rawName);
      if (hit) {
        const { flag, negated } = hit;
        if (flag.kind === "boolean") {
          rawFlagValues[flag.name] = negated
            ? false
            : eq === -1
              ? true
              : tok.slice(eq + 1) !== "false";
        } else if (flag.kind === "counter") {
          rawFlagValues[flag.name] =
            ((rawFlagValues[flag.name] as number | undefined) ?? 0) + 1;
        } else if (eq !== -1) {
          recordFlagValue(rawFlagValues, flag, tok.slice(eq + 1));
        } else if (flag.implicitValue !== undefined) {
          recordFlagValue(rawFlagValues, flag, flag.implicitValue);
        } else if (i + 1 < priorTokens.length) {
          recordFlagValue(rawFlagValues, flag, priorTokens[++i]);
        } else {
          pendingFlag = flag;
        }
      }

      continue;
    }

    if (tok.startsWith("-") && tok.length > 1) {
      for (let j = 1; j < tok.length; j++) {
        const flag = findShortFlag(scopeFlags, tok[j]);
        if (!flag) {
          continue;
        }
        if (flag.kind === "boolean") {
          rawFlagValues[flag.name] = true;
        } else if (flag.kind === "counter") {
          rawFlagValues[flag.name] =
            ((rawFlagValues[flag.name] as number | undefined) ?? 0) + 1;
        } else {
          const rest = tok.slice(j + 1);
          if (rest.startsWith("=")) {
            recordFlagValue(rawFlagValues, flag, rest.slice(1));
          } else if (rest.length > 0) {
            recordFlagValue(rawFlagValues, flag, rest);
          } else if (flag.implicitValue !== undefined) {
            recordFlagValue(rawFlagValues, flag, flag.implicitValue);
          } else if (i + 1 < priorTokens.length) {
            recordFlagValue(rawFlagValues, flag, priorTokens[++i]);
          } else {
            pendingFlag = flag;
          }

          break;
        }
      }

      continue;
    }

    if (inSubcommandSearch) {
      const child = node.children.get(tok) ?? node.aliasIndex.get(tok);
      if (child) {
        node = child;

        continue;
      }
      inSubcommandSearch = false;
    }

    words.push(tok);
  }

  const defaultNode =
    !model.tree.root.command && model.defaultCommand
      ? model.tree.findNode(model.defaultCommand)
      : undefined;
  const targetNode =
    node === model.tree.root && !node.command && defaultNode
      ? defaultNode
      : node;

  const activeFlags = getScopeFlags(targetNode, model, true);
  const resolvedFlags = applyFlagDefaults(
    activeFlags,
    rawFlagValues,
    terminal.env,
  );
  const mainArgs = targetNode.args.filter((a) => !a.afterDoubleDash);
  const ddArgs = targetNode.args.filter((a) => a.afterDoubleDash);
  const resolvedArgs = {
    ...buildPartialArgs(mainArgs, words),
    ...buildPartialArgs(ddArgs, doubleDashWords),
  };

  const baseCtx: CompletionContext = {
    current: rawCurrent,
    words,
    rawWords: priorTokens,
    args: resolvedArgs,
    flags: resolvedFlags,
    node: targetNode,
    model,
    terminal,
  };

  if (pendingFlag) {
    return completeFlagValue(pendingFlag, baseCtx);
  }

  const stoppedByFirstPositional =
    Boolean(targetNode.command?.stopAtFirstPositional) && words.length > 0;

  if (!afterDoubleDash && !stoppedByFirstPositional) {
    const inlineHit = matchInlineFlagValue(activeFlags, rawCurrent);
    if (inlineHit) {
      return completeFlagValue(inlineHit.flag, {
        ...baseCtx,
        current: inlineHit.valuePart,
      });
    }

    if (rawCurrent.startsWith("-")) {
      return completeFlagNames(activeFlags, rawCurrent);
    }
  }

  const subcommandCandidates: CompletionCandidate[] = [];
  if (!afterDoubleDash && inSubcommandSearch) {
    for (const child of model.tree.listVisibleChildren(node)) {
      if (child.command?.complete === false) {
        continue;
      }
      subcommandCandidates.push({
        value: child.name,
        description: child.command?.description ?? "",
      });
    }
    if (rawCurrent.length > 0) {
      for (const [alias, aliasNode] of node.aliasIndex) {
        if (
          aliasNode.command?.hidden ||
          aliasNode.command?.complete === false
        ) {
          continue;
        }
        subcommandCandidates.push({
          value: alias,
          description: aliasNode.command?.description ?? "",
        });
      }
    }
  }

  const cmd = targetNode.command;
  if (!cmd || cmd.hidden || cmd.complete === false) {
    return {
      candidates: filterAndDedupe(subcommandCandidates, rawCurrent),
      directive: ShellCompDirective.NoFileComp,
    };
  }

  let activeArgSlice = mainArgs;
  let activeWords = words;
  if (afterDoubleDash) {
    if (ddArgs.length > 0) {
      activeArgSlice = ddArgs;
      activeWords = doubleDashWords;
    } else if (cmd.argTokens.includes(DOUBLE_DASH)) {
      activeArgSlice = [];
      activeWords = doubleDashWords;
    } else {
      activeWords = [...words, ...doubleDashWords];
    }
  }

  const argIndex = activeWords.length;
  const targetArg =
    argIndex < activeArgSlice.length
      ? activeArgSlice[argIndex]
      : activeArgSlice.at(-1)?.isVariadic
        ? activeArgSlice.at(-1)
        : undefined;

  const positionalCtx: CompletionContext = {
    ...baseCtx,
    words: activeWords,
    argIndex,
  };

  let positionalResolved: ResolvedCompletions | undefined;
  if (targetArg?.complete === false) {
    positionalResolved = {
      candidates: [],
      directive: ShellCompDirective.NoFileComp,
    };
  } else if (typeof targetArg?.complete === "function") {
    positionalResolved = normalizeResult(
      await targetArg.complete(positionalCtx),
      rawCurrent,
    );
  } else if (typeof cmd.complete === "function") {
    const rawCmdRes = await cmd.complete(positionalCtx);
    if (rawCmdRes !== undefined) {
      positionalResolved = normalizeResult(rawCmdRes, rawCurrent);
    }
  }

  if (!positionalResolved && targetArg) {
    const enums = extractEnumCandidates(targetArg.toJsonSchema);
    if (enums) {
      positionalResolved = {
        candidates: filterAndDedupe(enums, rawCurrent),
        directive: ShellCompDirective.NoFileComp,
      };
    }
  }

  if (!positionalResolved) {
    return {
      candidates: filterAndDedupe(subcommandCandidates, rawCurrent),
      directive: ShellCompDirective.NoFileComp,
    };
  }

  if (subcommandCandidates.length === 0) {
    return positionalResolved;
  }

  return {
    candidates: filterAndDedupe(
      [...subcommandCandidates, ...positionalResolved.candidates],
      rawCurrent,
    ),
    directive: positionalResolved.directive,
  };
}

export function formatCompletionOutput(resolved: ResolvedCompletions): string {
  const lines = resolved.candidates.map((item) => {
    const desc = item.description?.replace(/[\r\n\t]+/g, " ").trim();

    return desc ? `${item.value}\t${desc}` : item.value;
  });
  lines.push(`:${resolved.directive}`);

  return lines.join("\n");
}
