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
  CompletionSpec,
  FlagConstraint,
  FlagDescriptor,
  Terminal,
} from "clerc";
import { parseBooleanLiteral } from "clerc";

import { ShellCompDirective } from "./directives";

export interface ResolvedCompletions {
  readonly candidates: readonly CompletionCandidate[];
  readonly directive: number;
}

export interface ResolveCompletionsOptions {
  readonly terminal?: Terminal;
}

export const evalDefault = (value: unknown): unknown =>
  typeof value === "function" ? (value as () => unknown)() : value;

export const flagToArgvSpec = (flag: FlagDescriptor): ArgvFlagSpec => ({
  key: flag.name,
  kind: flag.kind,
  short: flag.short,
  aliases: flag.aliases.length > 0 ? flag.aliases : undefined,
  negatable: flag.kind === "boolean" ? flag.negatable : undefined,
  optionalValue: flag.implicitValue !== undefined,
});

export const sanitizeDescription = (description?: string): string =>
  description ? description.replace(/[\r\n\t]+/g, " ").trim() : "";

export const resolveTargetNode = (node: CommandNode): CommandNode =>
  !node.command?.run && node.defaultChild ? node.defaultChild : node;

export function collectVisibleSubcommands(
  model: CliModel,
  node: CommandNode,
): CompletionCandidate[] {
  const out: CompletionCandidate[] = [];
  for (const child of model.tree.listVisibleChildren(node)) {
    if (child.command?.complete === false) {
      continue;
    }
    out.push({
      value: child.name,
      description: sanitizeDescription(child.command?.description),
    });
  }

  return out;
}

export function collectVisibleAliases(
  node: CommandNode,
): CompletionCandidate[] {
  const out: CompletionCandidate[] = [];
  for (const [alias, aliasNode] of node.aliasIndex) {
    if (aliasNode.command?.hidden || aliasNode.command?.complete === false) {
      continue;
    }
    out.push({
      value: alias,
      description: sanitizeDescription(aliasNode.command?.description),
    });
  }

  return out;
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
      resolved[flag.name] = evalDefault(flag.default);
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

  const spec = result as CompletionSpec;
  switch (spec.kind) {
    case "file": {
      if (spec.extensions && spec.extensions.length > 0) {
        return {
          candidates: spec.extensions.map((ext) => ({
            value: ext.replace(/^\./, ""),
          })),
          directive: ShellCompDirective.FilterFileExt,
        };
      }

      return { candidates: [], directive: ShellCompDirective.Default };
    }
    case "dir": {
      return { candidates: [], directive: ShellCompDirective.FilterDirs };
    }
    case "list": {
      let directive: number = spec.allowFiles
        ? ShellCompDirective.Default
        : ShellCompDirective.NoFileComp;
      if (spec.noSpace) {
        directive |= ShellCompDirective.NoSpace;
      }
      if (spec.keepOrder) {
        directive |= ShellCompDirective.KeepOrder;
      }

      return {
        candidates: filterAndDedupe(spec.items.map(toCandidate), current),
        directive,
      };
    }
  }
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
  } else if (flag.complete === undefined) {
    const enums = extractEnumCandidates(flag.toJsonSchema);
    resolved = enums
      ? {
          candidates: filterAndDedupe(enums, itemCurrent),
          directive: ShellCompDirective.NoFileComp,
        }
      : { candidates: [], directive: ShellCompDirective.NoFileComp };
  } else {
    resolved = normalizeResult(flag.complete, itemCurrent);
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

export function collectConflictedFlags(
  constraints: readonly FlagConstraint[],
  usedFlags: ReadonlySet<string>,
): ReadonlySet<string> {
  const conflictedFlags = new Set<string>();

  for (const constraint of constraints) {
    if (constraint.kind !== "exclusive" && constraint.kind !== "oneOf") {
      continue;
    }
    for (const branch of constraint.branches) {
      if (!branch.flags.some((f) => usedFlags.has(f))) {
        continue;
      }
      for (const other of constraint.branches) {
        if (other === branch) {
          continue;
        }
        for (const f of other.flags) {
          if (!usedFlags.has(f)) {
            conflictedFlags.add(f);
          }
        }
      }
    }
  }

  return conflictedFlags;
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
