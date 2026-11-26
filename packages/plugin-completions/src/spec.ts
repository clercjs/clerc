import type {
  ArgDescriptor,
  CliModel,
  CommandNode,
  CompletionCandidate,
  CompletionResult,
  FlagDescriptor,
} from "clerc";

import { ShellCompDirective } from "./directives";
import {
  extractEnumCandidates,
  getScopeFlags,
  normalizeResult,
} from "./helpers";

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

const DOUBLE_DASH = "--";

export const sanitizeIdentifier = (name: string): string =>
  name.replace(/[-:./\s]/g, "_");

export const sanitizeDescription = (description?: string): string =>
  description ? description.replace(/[\r\n\t]+/g, " ").trim() : "";

const camelCase = (str: string): string =>
  str.includes("-") || str.includes(" ")
    ? str.replace(/[- ](.?)/g, (_, c: string) => c.toUpperCase())
    : str;

function kebabCase(str: string): string {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      let out = str.slice(0, i);
      for (let j = i; j < str.length; j++) {
        const ch = str.charCodeAt(j);
        out +=
          ch >= 65 && ch <= 90 ? `-${String.fromCharCode(ch + 32)}` : str[j];
      }

      return out;
    }
  }

  return str;
}

function collectLongParseNames(flag: FlagDescriptor): readonly string[] {
  const base = new Set<string>();
  function addVariants(raw: string): void {
    base.add(raw);
    base.add(camelCase(raw));
    base.add(kebabCase(raw));
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

  // Pass 1: assign stable integer IDs to every node in the tree
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

  // Pass 2: compile each node into a flat StaticNodeSpec
  const nodes: StaticNodeSpec[] = orderedNodes.map((node) => {
    const id = nodeIds.get(node)!;
    const targetNode =
      !node.command?.run && node.defaultChild ? node.defaultChild : node;

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

    const visibleSubcommands: StaticCandidate[] = [];
    for (const child of model.tree.listVisibleChildren(node)) {
      if (child.command?.complete === false) {
        continue;
      }
      visibleSubcommands.push({
        value: child.name,
        description: sanitizeDescription(child.command?.description),
      });
    }

    const visibleAliases: StaticCandidate[] = [];
    for (const [alias, aliasNode] of node.aliasIndex) {
      if (aliasNode.command?.hidden || aliasNode.command?.complete === false) {
        continue;
      }
      visibleAliases.push({
        value: alias,
        description: sanitizeDescription(aliasNode.command?.description),
      });
    }

    const activeFlags = getScopeFlags(targetNode, model, true);
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

    const mainArgIndexByName = new Map(
      mainArgDescs.map((a, idx) => [a.name, idx]),
    );
    const ddArgIndexByName = new Map(ddArgDescs.map((a, idx) => [a.name, idx]));
    const conflictGroups: string[][] = [];
    for (const rule of targetNode.rules) {
      if (rule.kind !== "exclusive" && rule.kind !== "oneOf") {
        continue;
      }
      const group: string[] = [];
      for (const ref of rule.targets) {
        if (ref.kind === "flag") {
          group.push(`f:${ref.name}`);
        } else {
          const mIdx = mainArgIndexByName.get(ref.name);
          if (mIdx === undefined) {
            const dIdx = ddArgIndexByName.get(ref.name);
            if (dIdx !== undefined) {
              group.push(`d:${dIdx}`);
            }
          } else {
            group.push(`m:${mIdx}`);
          }
        }
      }
      if (group.length >= 2) {
        conflictGroups.push(group);
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
