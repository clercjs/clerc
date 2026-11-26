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
  getCommandFlags,
} from "clerc";

import { ShellCompDirective } from "./directives";
import type { ResolveCompletionsOptions, ResolvedCompletions } from "./helpers";
import {
  applyFlagDefaults,
  buildPartialArgs,
  collectConflictedTargets,
  collectVisibleAliases,
  collectVisibleSubcommands,
  completeFlagNames,
  completeFlagValue,
  extractEnumCandidates,
  filterAndDedupe,
  flagsToSpecs,
  matchInlineFlagValue,
  normalizeResult,
  resolveTargetNode,
  sanitizeDescription,
} from "./helpers";

const DOUBLE_DASH = "--";

export async function resolveCompletions(
  model: CliModel,
  input: readonly string[],
  options: ResolveCompletionsOptions = {},
): Promise<ResolvedCompletions> {
  const terminal = options.terminal ?? createMemoryTerminal();
  const priorTokens = input.length > 0 ? input.slice(0, -1) : [];
  const rawCurrent = input.at(-1) ?? "";

  let node: CommandNode = model.tree.root;
  const matchedIndices: number[] = [];
  let isContiguousPrefix = true;
  let startIndex = 0;

  while (startIndex < priorTokens.length) {
    const scanNode = resolveTargetNode(node);
    const scanner = createArgvParser(
      flagsToSpecs(getCommandFlags(model, scanNode, { includeBuiltins: true })),
    );
    let matched = false;
    scanner.scan(
      priorTokens,
      (tok, index) => {
        const child = node.children.get(tok) ?? node.aliasIndex.get(tok);
        if (!child) {
          return false;
        }
        if (index !== matchedIndices.length) {
          isContiguousPrefix = false;
        }
        node = child;
        matchedIndices.push(index);
        startIndex = index + 1;
        matched = true;

        return false;
      },
      startIndex,
    );
    if (!matched) {
      break;
    }
  }

  const remainingPrior =
    matchedIndices.length === 0
      ? priorTokens
      : isContiguousPrefix
        ? priorTokens.slice(matchedIndices.length)
        : priorTokens.filter((_, idx) => !new Set(matchedIndices).has(idx));

  const targetNode = resolveTargetNode(node);

  const activeFlags = getCommandFlags(model, targetNode, {
    includeBuiltins: true,
  });
  const flagByName = new Map(activeFlags.map((flag) => [flag.name, flag]));
  const targetParser = createArgvParser(flagsToSpecs(activeFlags), {
    stopParsing: targetNode.command?.stopParsing,
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

  const usedFlags = new Set(parsed.provided);
  const usedArgs = new Set(Object.keys(resolvedArgs));
  const conflicted = collectConflictedTargets(
    targetNode.rules,
    usedFlags,
    usedArgs,
  );

  if (!afterDoubleDash && !parsed.stoppedEarly) {
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

  const subcommandCandidates: CompletionCandidate[] = inSubcommandSearch
    ? [
        ...collectVisibleSubcommands(model, node),
        ...(rawCurrent.length > 0 ? collectVisibleAliases(node) : []),
      ]
    : [];

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
  } else if (targetArg?.complete !== undefined) {
    positionalResolved = normalizeResult(targetArg.complete, rawCurrent);
  } else if (typeof cmd.complete === "function") {
    const rawCmdRes = await cmd.complete(positionalCtx);
    if (rawCmdRes !== undefined) {
      positionalResolved = normalizeResult(rawCmdRes, rawCurrent);
    }
  } else if (cmd.complete !== undefined) {
    positionalResolved = normalizeResult(cmd.complete, rawCurrent);
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
    const desc = sanitizeDescription(item.description);

    return desc ? `${item.value}\t${desc}` : item.value;
  });
  lines.push(`:${resolved.directive}`);

  return lines.join("\n");
}
