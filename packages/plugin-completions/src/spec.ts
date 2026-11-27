import type {
  ArgDescriptor,
  CliModel,
  CommandNode,
  CompletionCandidate,
  CompletionResult,
  FlagDescriptor,
} from "clerc";
import { getCommandFlags } from "clerc";

import { ShellCompDirective } from "./directives";
import {
  collectVisibleAliases,
  collectVisibleSubcommands,
  extractEnumCandidates,
  normalizeResult,
  resolveTargetNode,
  sanitizeDescription,
} from "./helpers";

const DOUBLE_DASH = "--";

const toCamelCase = (str: string): string =>
  str.replace(/-([a-z\d])/g, (_, ch: string) => ch.toUpperCase());

const toKebabCase = (str: string): string =>
  str
    .replace(/([a-z\d])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();

export interface StaticCandidate {
  readonly value: string;
  readonly description: string;
}

export type StaticValueSpec =
  | { readonly kind: "none" }
  | {
      readonly kind: "static";
      readonly candidates: readonly StaticCandidate[];
      readonly directive: number;
    }
  | { readonly kind: "dynamic" };

export interface StaticFlagSpec {
  readonly name: string;
  readonly target: string;
  readonly aliases: readonly string[];
  readonly longParseNames: readonly string[];
  readonly short?: string;
  readonly takesValue: boolean;
  readonly acceptsInlineValue: boolean;
  readonly repeatable: boolean;
  readonly negatable: boolean;
  readonly defaultTrue: boolean;
  readonly delimiter?: string;
  readonly completable: boolean;
  readonly description: string;
  readonly value: StaticValueSpec;
}

export interface StaticArgSpec {
  readonly name: string;
  readonly isVariadic: boolean;
  readonly value: StaticValueSpec;
}

export interface StaticTransition {
  readonly token: string;
  readonly targetId: number;
}

export interface StaticNodeSpec {
  readonly id: number;
  readonly transitions: readonly StaticTransition[];
  readonly visibleSubcommands: readonly StaticCandidate[];
  readonly visibleAliases: readonly StaticCandidate[];
  readonly flags: readonly StaticFlagSpec[];
  readonly hasDigitShort: boolean;
  readonly stopParsing:
    "none" | "first-positional" | "unknown-flag" | "dynamic";
  readonly isBuiltinHelp: boolean;
  readonly positionalsDisabled: boolean;
  readonly mainArgs: readonly StaticArgSpec[];
  readonly ddArgs: readonly StaticArgSpec[];
  readonly hasDoubleDashToken: boolean;
  readonly overflowValue: StaticValueSpec;
  readonly conflictGroups: readonly (readonly string[])[];
}

export interface StaticCompletionSpec {
  readonly name: string;
  readonly bin: string;
  readonly fn: string;
  readonly hasDynamic: boolean;
  readonly nodes: readonly StaticNodeSpec[];
}

export const sanitizeIdentifier = (name: string): string =>
  name.replace(/[-:./\s]/g, "_");

function collectLongParseNames(flag: FlagDescriptor): readonly string[] {
  const base = new Set<string>();
  function addVariants(raw: string): void {
    base.add(raw);
    base.add(toCamelCase(raw));
    base.add(toKebabCase(raw));
  }
  addVariants(flag.name);
  for (const alias of flag.aliases) {
    addVariants(alias);
  }
  const all = new Set<string>(base);
  if (flag.kind === "boolean" && flag.negatable) {
    for (const name of base) {
      all.add(`no-${name}`);
    }
  }

  return [...all];
}

const toStaticCandidates = (
  items: readonly CompletionCandidate[],
): readonly StaticCandidate[] =>
  items.map((item) => ({
    value: item.value,
    description: sanitizeDescription(item.description),
  }));

function fromStaticResult(result: CompletionResult): StaticValueSpec {
  const resolved = normalizeResult(result, "");
  if (
    resolved.candidates.length === 0 &&
    resolved.directive === ShellCompDirective.NoFileComp
  ) {
    return { kind: "none" };
  }

  return {
    kind: "static",
    candidates: toStaticCandidates(resolved.candidates),
    directive: resolved.directive,
  };
}

function resolveFlagValueSpec(flag: FlagDescriptor): StaticValueSpec {
  const completable = !flag.hidden && flag.complete !== false;
  const acceptsInlineValue = flag.kind === "single" || flag.kind === "array";
  if (!completable || !acceptsInlineValue) {
    return { kind: "none" };
  }
  if (typeof flag.complete === "function") {
    return { kind: "dynamic" };
  }
  if (flag.complete !== undefined) {
    return fromStaticResult(flag.complete);
  }
  const enums = extractEnumCandidates(flag.toJsonSchema);

  return enums
    ? {
        kind: "static",
        candidates: toStaticCandidates(enums),
        directive: ShellCompDirective.NoFileComp,
      }
    : { kind: "none" };
}

function resolveArgValueSpec(
  arg: ArgDescriptor,
  cmdValueSpec: StaticValueSpec | undefined,
): StaticValueSpec {
  if (arg.complete === false) {
    return { kind: "none" };
  }
  if (typeof arg.complete === "function") {
    return { kind: "dynamic" };
  }
  if (arg.complete !== undefined) {
    return fromStaticResult(arg.complete);
  }
  if (cmdValueSpec !== undefined) {
    return cmdValueSpec;
  }
  const enums = extractEnumCandidates(arg.toJsonSchema);

  return enums
    ? {
        kind: "static",
        candidates: toStaticCandidates(enums),
        directive: ShellCompDirective.NoFileComp,
      }
    : { kind: "none" };
}

export function buildCompletionSpec(
  model: CliModel,
  executable?: string,
): StaticCompletionSpec {
  const name = model.meta.name;
  const bin = executable ?? name;
  const fn = sanitizeIdentifier(name);

  const orderedNodes: CommandNode[] = [];
  const nodeIds = new Map<CommandNode, number>();
  function visit(node: CommandNode): void {
    if (nodeIds.has(node)) {
      return;
    }
    nodeIds.set(node, orderedNodes.length);
    orderedNodes.push(node);
    for (const child of node.children.values()) {
      visit(child);
    }
  }
  visit(model.tree.root);

  let hasDynamic = false;
  function markIfDynamic(spec: StaticValueSpec): StaticValueSpec {
    if (spec.kind === "dynamic") {
      hasDynamic = true;
    }

    return spec;
  }

  const nodes: StaticNodeSpec[] = orderedNodes.map((node) => {
    const id = nodeIds.get(node)!;
    const targetNode = resolveTargetNode(node);

    const transitions: StaticTransition[] = [];
    for (const [childName, child] of node.children) {
      const targetId = nodeIds.get(child);
      if (targetId !== undefined) {
        transitions.push({ token: childName, targetId });
      }
    }
    for (const [alias, aliasNode] of node.aliasIndex) {
      if (node.children.has(alias)) {
        continue;
      }
      const targetId = nodeIds.get(aliasNode);
      if (targetId !== undefined) {
        transitions.push({ token: alias, targetId });
      }
    }

    const visibleSubcommands = toStaticCandidates(
      collectVisibleSubcommands(model, node),
    );
    const visibleAliases = toStaticCandidates(collectVisibleAliases(node));

    const activeFlags = getCommandFlags(model, targetNode, {
      includeBuiltins: true,
    });
    const flags: StaticFlagSpec[] = activeFlags.map((flag) => ({
      name: flag.name,
      target: flag.target,
      aliases: flag.aliases,
      longParseNames: collectLongParseNames(flag),
      short: flag.short,
      takesValue:
        (flag.kind === "single" || flag.kind === "array") &&
        flag.implicitValue === undefined,
      acceptsInlineValue: flag.kind === "single" || flag.kind === "array",
      repeatable: flag.kind === "array" || flag.kind === "counter",
      negatable: flag.kind === "boolean" && flag.negatable,
      defaultTrue:
        flag.kind === "boolean" && flag.negatable && flag.default === true,
      delimiter: flag.kind === "array" ? flag.delimiter : undefined,
      completable: !flag.hidden && flag.complete !== false,
      description: sanitizeDescription(flag.description),
      value: markIfDynamic(resolveFlagValueSpec(flag)),
    }));

    const hasDigitShort = flags.some(
      (f) => f.short !== undefined && f.short >= "0" && f.short <= "9",
    );

    const rawStop = targetNode.command?.stopParsing;
    let stopParsing: StaticNodeSpec["stopParsing"] = "none";
    if (rawStop === "first-positional" || rawStop === "unknown-flag") {
      stopParsing = rawStop;
    } else if (typeof rawStop === "function") {
      stopParsing = "dynamic";
      hasDynamic = true;
    }

    const cmd = targetNode.command;
    const isBuiltinHelp = Boolean(
      cmd?.builtin &&
      targetNode.fullPath.length === 1 &&
      targetNode.name === "help",
    );
    const positionalsDisabled =
      !cmd || Boolean(cmd.hidden) || cmd.complete === false;

    const mainArgDescs = targetNode.args.filter((a) => !a.afterDoubleDash);
    const ddArgDescs = targetNode.args.filter((a) => a.afterDoubleDash);

    let mainArgs: StaticArgSpec[] = [];
    let ddArgs: StaticArgSpec[] = [];
    let overflowValue: StaticValueSpec = { kind: "none" };
    let hasDoubleDashToken = false;

    if (!isBuiltinHelp && !positionalsDisabled) {
      hasDoubleDashToken = cmd.argTokens.includes(DOUBLE_DASH);
      let cmdValueSpec: StaticValueSpec | undefined;
      if (typeof cmd.complete === "function") {
        cmdValueSpec = { kind: "dynamic" };
      } else if (cmd.complete !== undefined) {
        cmdValueSpec = fromStaticResult(cmd.complete);
      }
      if (cmdValueSpec) {
        markIfDynamic(cmdValueSpec);
      }

      mainArgs = mainArgDescs.map((arg) => ({
        name: arg.name,
        isVariadic: arg.isVariadic,
        value: markIfDynamic(resolveArgValueSpec(arg, cmdValueSpec)),
      }));
      ddArgs = ddArgDescs.map((arg) => ({
        name: arg.name,
        isVariadic: arg.isVariadic,
        value: markIfDynamic(resolveArgValueSpec(arg, cmdValueSpec)),
      }));
      overflowValue = markIfDynamic(cmdValueSpec ?? { kind: "none" });
    }

    const conflictGroups: string[][] = [];
    for (const constraint of targetNode.constraints) {
      if (constraint.kind !== "exclusive" && constraint.kind !== "oneOf") {
        continue;
      }
      if (constraint.branches.every((b) => b.flags.length === 1)) {
        const group = constraint.branches.map((b) => `f:${b.flags[0]}`);
        if (group.length >= 2) {
          conflictGroups.push(group);
        }
      } else {
        for (let i = 0; i < constraint.branches.length; i++) {
          for (let j = i + 1; j < constraint.branches.length; j++) {
            for (const fi of constraint.branches[i].flags) {
              for (const fj of constraint.branches[j].flags) {
                conflictGroups.push([`f:${fi}`, `f:${fj}`]);
              }
            }
          }
        }
      }
    }

    return {
      id,
      transitions,
      visibleSubcommands,
      visibleAliases,
      flags,
      hasDigitShort,
      stopParsing,
      isBuiltinHelp,
      positionalsDisabled,
      mainArgs,
      ddArgs,
      hasDoubleDashToken,
      overflowValue,
      conflictGroups,
    };
  });

  return { name, bin, fn, hasDynamic, nodes };
}
