import type {
  ArgDescriptor,
  ArgvFlagSpec,
  ArgvParser,
  CliModel,
  CommandNode,
  CompletionCandidate,
  CompletionContext,
  CompletionItem,
  CompletionResult,
  FlagDescriptor,
  RuleDescriptor,
  Terminal,
} from "clerc";
import { parseBooleanLiteral } from "clerc";

import { ShellCompDirective } from "./shells";

export interface ResolvedCompletions {
  readonly candidates: readonly CompletionCandidate[];
  readonly directive: number;
}

export interface ResolveCompletionsOptions {
  readonly terminal?: Terminal;
}

const toCandidate = (item: CompletionItem): CompletionCandidate =>
  typeof item === "string"
    ? { value: item }
    : { value: item.value, description: item.description };

export function extractEnumCandidates(
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

export function getScopeFlags(
  node: CommandNode,
  model: CliModel,
  includeBuiltins: boolean,
): readonly FlagDescriptor[] {
  const isStandalone = Boolean(node.command?.standalone);
  const localNames = new Set(node.localFlags.map((f) => f.name));

  return [
    ...(isStandalone
      ? []
      : model.globalFlags.filter((f) => !localNames.has(f.name))),
    ...node.localFlags,
    ...(includeBuiltins ? node.builtinFlags : []),
  ];
}

export const flagsToSpecs = (
  flags: readonly FlagDescriptor[],
): ArgvFlagSpec[] =>
  flags.map((flag) => ({
    key: flag.name,
    kind: flag.kind,
    short: flag.short,
    aliases: flag.aliases.length > 0 ? flag.aliases : undefined,
    negatable: flag.kind === "boolean" ? flag.negatable : undefined,
    optionalValue: flag.implicitValue !== undefined,
  }));

export function applyFlagDefaults(
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
      if (flag.kind === "boolean") {
        resolved[flag.name] = parseBooleanLiteral(envVal) ?? false;
      } else if (flag.kind === "counter") {
        const trimmed = envVal.trim();
        const count = trimmed === "" ? Number.NaN : Number(trimmed);
        resolved[flag.name] =
          Number.isInteger(count) && count >= 0
            ? count
            : parseBooleanLiteral(trimmed)
              ? 1
              : 0;
      } else if (flag.kind === "array") {
        resolved[flag.name] = envVal
          .split(flag.delimiter ?? ",")
          .map((s) => s.trim());
      } else {
        resolved[flag.name] = envVal;
      }

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

export function buildPartialArgs(
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

export function filterAndDedupe(
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

export function normalizeResult(
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

export async function completeFlagValue(
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

export function matchInlineFlagValue(
  parser: ArgvParser,
  flagByName: ReadonlyMap<string, FlagDescriptor>,
  rawCurrent: string,
): { readonly flag: FlagDescriptor; readonly valuePart: string } | undefined {
  const eq = rawCurrent.indexOf("=");
  if (eq === -1 || !rawCurrent.startsWith("-")) {
    return undefined;
  }
  const parsed = parser.parse([rawCurrent]);
  const lastKey = parsed.provided.at(-1);
  if (!lastKey) {
    return undefined;
  }
  const flag = flagByName.get(lastKey);
  if (!flag || flag.kind === "boolean" || flag.kind === "counter") {
    return undefined;
  }
  const rawVal = parsed.flags[lastKey];
  const parsedVal = Array.isArray(rawVal) ? rawVal[0] : rawVal;
  const valuePart = rawCurrent.slice(eq + 1);
  if (parsedVal !== valuePart) {
    return undefined;
  }

  return { flag, valuePart };
}

export function collectConflictedTargets(
  rules: readonly RuleDescriptor[],
  usedFlags: ReadonlySet<string>,
  usedArgs: ReadonlySet<string>,
): {
  readonly flags: ReadonlySet<string>;
  readonly args: ReadonlySet<string>;
} {
  const conflictedFlags = new Set<string>();
  const conflictedArgs = new Set<string>();

  for (const rule of rules) {
    if (rule.kind !== "exclusive" && rule.kind !== "oneOf") {
      continue;
    }
    const anyUsed = rule.targets.some((ref) =>
      ref.kind === "flag" ? usedFlags.has(ref.name) : usedArgs.has(ref.name),
    );
    if (!anyUsed) {
      continue;
    }
    for (const ref of rule.targets) {
      if (ref.kind === "flag") {
        if (!usedFlags.has(ref.name)) {
          conflictedFlags.add(ref.name);
        }
      } else if (!usedArgs.has(ref.name)) {
        conflictedArgs.add(ref.name);
      }
    }
  }

  return { flags: conflictedFlags, args: conflictedArgs };
}

export function completeFlagNames(
  flags: readonly FlagDescriptor[],
  current: string,
  usedFlags: ReadonlySet<string>,
  conflictedFlags: ReadonlySet<string>,
): ResolvedCompletions {
  const isShortOnly =
    current.startsWith("-") && !current.startsWith("--") && current.length > 1;
  const showAllNegated = current.startsWith("--no");
  const items: CompletionCandidate[] = [];

  for (const flag of flags) {
    if (flag.hidden || flag.complete === false) {
      continue;
    }
    if (
      flag.kind !== "array" &&
      flag.kind !== "counter" &&
      usedFlags.has(flag.name)
    ) {
      continue;
    }
    if (conflictedFlags.has(flag.name)) {
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
