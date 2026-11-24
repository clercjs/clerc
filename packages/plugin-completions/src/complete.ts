import type {
  CliModel,
  CommandNode,
  CompletionCandidate,
  CompletionContext,
} from "clerc";
import {
  IMPLICIT_FLAG_VALUE,
  createArgvParser,
  createMemoryTerminal,
} from "clerc";

import type { ResolveCompletionsOptions, ResolvedCompletions } from "./helpers";
import {
  applyFlagDefaults,
  buildPartialArgs,
  collectConflictedTargets,
  completeFlagNames,
  completeFlagValue,
  extractEnumCandidates,
  filterAndDedupe,
  flagsToSpecs,
  getScopeFlags,
  matchInlineFlagValue,
  normalizeResult,
} from "./helpers";
import { ShellCompDirective } from "./shells";

const DOUBLE_DASH = "--";

export async function resolveCompletions(
  model: CliModel,
  input: readonly string[],
  options: ResolveCompletionsOptions = {},
): Promise<ResolvedCompletions> {
  const terminal = options.terminal ?? createMemoryTerminal();
  const priorTokens = input.length > 0 ? input.slice(0, -1) : [];
  const rawCurrent = input.at(-1) ?? "";

  const defaultNode =
    !model.tree.root.command && model.defaultCommand
      ? model.tree.findNode(model.defaultCommand)
      : undefined;

  const rootScanNode =
    !model.tree.root.command && defaultNode ? defaultNode : model.tree.root;
  const rootScanner = createArgvParser(
    flagsToSpecs(getScopeFlags(rootScanNode, model, true)),
  );

  let node: CommandNode = model.tree.root;
  const matchedIndices: number[] = [];
  let isContiguousPrefix = true;

  rootScanner.scan(priorTokens, (tok, index) => {
    const child = node.children.get(tok) ?? node.aliasIndex.get(tok);
    if (!child) {
      return false;
    }
    if (index !== matchedIndices.length) {
      isContiguousPrefix = false;
    }
    node = child;
    matchedIndices.push(index);

    return true;
  });

  const remainingPrior =
    matchedIndices.length === 0
      ? priorTokens
      : isContiguousPrefix
        ? priorTokens.slice(matchedIndices.length)
        : priorTokens.filter((_, idx) => !new Set(matchedIndices).has(idx));

  const targetNode =
    node === model.tree.root && !node.command && defaultNode
      ? defaultNode
      : node;

  const activeFlags = getScopeFlags(targetNode, model, true);
  const flagByName = new Map(activeFlags.map((flag) => [flag.name, flag]));
  const targetParser = createArgvParser(flagsToSpecs(activeFlags), {
    stopAtFirstPositional: targetNode.command?.stopAtFirstPositional,
  });
  const parsed = targetParser.parse(remainingPrior);
  const afterDoubleDash = parsed.hasDoubleDash;
  const words = parsed.positionals;
  const doubleDashWords = parsed.doubleDash;
  const inSubcommandSearch = !afterDoubleDash && words.length === 0;

  const rawFlagValues: Record<string, unknown> = {};
  for (const key of parsed.provided) {
    const flag = flagByName.get(key);
    if (!flag) {
      continue;
    }
    const raw = parsed.flags[key];
    if (raw === IMPLICIT_FLAG_VALUE) {
      rawFlagValues[key] =
        typeof flag.implicitValue === "function"
          ? (flag.implicitValue as () => unknown)()
          : flag.implicitValue;
    } else if (flag.kind === "array" && flag.delimiter) {
      rawFlagValues[key] = (raw as string[]).flatMap((v) =>
        v.split(flag.delimiter!),
      );
    } else {
      rawFlagValues[key] = raw;
    }
  }

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

  const pendingFlag = parsed.trailingMissingValueFlag
    ? flagByName.get(parsed.trailingMissingValueFlag)
    : undefined;
  if (pendingFlag) {
    return completeFlagValue(pendingFlag, baseCtx);
  }

  const activeRules = targetNode.command?.standalone
    ? targetNode.rules
    : [...model.globalRules, ...targetNode.rules];
  const usedFlags = new Set(parsed.provided);
  const usedArgs = new Set(Object.keys(resolvedArgs));
  const conflicted = collectConflictedTargets(activeRules, usedFlags, usedArgs);

  const stoppedByFirstPositional =
    Boolean(targetNode.command?.stopAtFirstPositional) && words.length > 0;

  if (!afterDoubleDash && !stoppedByFirstPositional) {
    const inlineHit = matchInlineFlagValue(
      targetParser,
      flagByName,
      rawCurrent,
    );
    if (inlineHit) {
      return completeFlagValue(inlineHit.flag, {
        ...baseCtx,
        current: inlineHit.valuePart,
      });
    }

    if (rawCurrent.startsWith("-")) {
      return completeFlagNames(
        activeFlags,
        rawCurrent,
        usedFlags,
        conflicted.flags,
      );
    }
  }

  const subcommandCandidates: CompletionCandidate[] = [];
  if (inSubcommandSearch) {
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
  if (
    targetArg?.complete === false ||
    (targetArg && conflicted.args.has(targetArg.name))
  ) {
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
