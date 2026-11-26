import type { ArgDescriptor } from "../args";
import type { CommandNode, CommandTree } from "../command-tree";
import { getCommandFlags } from "../command-tree";
import type { FlagDescriptor } from "../flags";
import { DOUBLE_DASH } from "../parser";
import type { MultiRuleKind, RuleDescriptor, RuleRef } from "../rules";
import { formatRuleRef } from "../rules";
import type { CliModel, GroupDefinition } from "../types";
import { formatFlagName, formatVersion, resolveAsyncValue } from "../utils";

export interface HelpHeader {
  readonly name: string;
  readonly commandPath: readonly string[];
  readonly version: string;
  readonly description?: string;
  readonly aliases: readonly string[];
}

export interface HelpUsageArg {
  readonly text: string;
  readonly kind: "arg" | "double-dash";
  readonly optional: boolean;
}

export interface HelpUsage {
  readonly command: string;
  readonly subcommand: "required" | "optional" | "none";
  readonly hasOptions: boolean;
  readonly args: readonly HelpUsageArg[];
}

export interface HelpArgumentItem {
  readonly name: string;
  readonly token: string;
  readonly typeLabel?: string;
  readonly description?: string;
  readonly defaultText?: string;
  readonly env?: string;
  readonly required: boolean;
  readonly variadic: boolean;
  readonly constraints?: readonly string[];
}

export interface HelpCommandItem {
  readonly name: string;
  readonly aliases: readonly string[];
  readonly description?: string;
  readonly isDefault?: boolean;
  readonly deprecated?: boolean | string;
}

export interface HelpCommandGroup {
  readonly title: string;
  readonly items: readonly HelpCommandItem[];
}

export interface HelpOptionItem {
  readonly name: string;
  readonly longName: string;
  readonly short?: string;
  readonly aliases: readonly string[];
  readonly negatedName?: string;
  readonly placeholder?: string;
  readonly optionalValue: boolean;
  readonly description?: string;
  readonly required: boolean;
  readonly defaultText?: string;
  readonly env?: string;
  readonly deprecated?: boolean | string;
  readonly constraints?: readonly string[];
}

export interface HelpOptionGroup {
  readonly title: string;
  readonly tags?: readonly string[];
  readonly items: readonly HelpOptionItem[];
}

export interface HelpExampleItem {
  readonly command: string;
  readonly description?: string;
}

export interface HelpDocument {
  readonly header: HelpHeader;
  readonly usage: HelpUsage;
  readonly arguments: readonly HelpArgumentItem[];
  readonly commandGroups: readonly HelpCommandGroup[];
  readonly optionGroups: readonly HelpOptionGroup[];
  readonly globalOptionGroups: readonly HelpOptionGroup[];
  readonly examples: readonly HelpExampleItem[];
  readonly notes: readonly string[];
}

function formatDefaultValue(value: unknown): string {
  if (
    typeof value === "function" &&
    "display" in value &&
    typeof value.display === "string"
  ) {
    return value.display;
  }
  if (typeof value === "string") {
    return value.length === 0 || /[\s"']/.test(value)
      ? JSON.stringify(value)
      : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function buildOptionItem(
  flag: FlagDescriptor,
  constraints?: readonly string[],
): HelpOptionItem {
  const placeholder =
    flag.placeholder ??
    (flag.kind === "boolean" || flag.kind === "counter"
      ? undefined
      : `<${flag.display}>`);
  const negatedName =
    flag.kind === "boolean" && flag.negatable && flag.default === true
      ? `--no-${flag.target.slice(2)}`
      : undefined;
  const defaultText =
    flag.default !== undefined &&
    (flag.kind !== "boolean" || flag.default !== false)
      ? formatDefaultValue(flag.default)
      : undefined;

  return {
    name: flag.name,
    longName: flag.target,
    short: flag.short,
    aliases: flag.aliases.map(formatFlagName),
    negatedName,
    placeholder,
    optionalValue: flag.implicitValue !== undefined,
    description: flag.description,
    required: flag.required,
    defaultText,
    env: flag.env,
    deprecated: flag.deprecated,
    ...(constraints?.length ? { constraints } : {}),
  };
}

const buildArgumentItem = (
  arg: ArgDescriptor,
  constraints?: readonly string[],
): HelpArgumentItem => ({
  name: arg.name,
  token: arg.token,
  typeLabel: arg.display,
  description: arg.description,
  defaultText:
    arg.default === undefined ? undefined : formatDefaultValue(arg.default),
  env: arg.env,
  required: arg.isRequired,
  variadic: arg.isVariadic,
  ...(constraints?.length ? { constraints } : {}),
});

const GROUP_RULE_BADGES: Readonly<Record<MultiRuleKind, string>> = {
  exclusive: "exclusive",
  oneOf: "one of",
  atLeastOne: "at least one",
  together: "together",
};

function collectRuleAnnotations(
  rules: readonly RuleDescriptor[],
  flagMap: ReadonlyMap<string, FlagDescriptor>,
  argMap: ReadonlyMap<string, ArgDescriptor>,
  visibleFlagGroups: ReadonlySet<string>,
  flagGroupTitles: ReadonlyMap<string, string>,
): {
  readonly flagTags: Map<string, string[]>;
  readonly argTags: Map<string, string[]>;
  readonly groupTags: Map<string, string[]>;
} {
  const flagTags = new Map<string, string[]>();
  const argTags = new Map<string, string[]>();
  const groupTags = new Map<string, string[]>();
  const fmt = (ref: RuleRef) => formatRuleRef(ref, flagMap, argMap);

  function pushTag(map: Map<string, string[]>, key: string, tag: string) {
    let list = map.get(key);
    if (!list) {
      list = [];
      map.set(key, list);
    }
    if (!list.includes(tag)) {
      list.push(tag);
    }
  }

  function pushRefTag(ref: RuleRef, tag: string) {
    pushTag(ref.kind === "flag" ? flagTags : argTags, ref.name, tag);
  }

  for (const rule of rules) {
    if (rule.kind === "requires") {
      const targetText =
        rule.group && rule.targets.length > 4
          ? `group '${flagGroupTitles.get(rule.group) ?? rule.group}'`
          : rule.targets.map(fmt).join(", ");
      pushRefTag(rule.source, `requires: ${targetText}`);

      continue;
    }

    if (rule.group && visibleFlagGroups.has(rule.group)) {
      pushTag(groupTags, rule.group, GROUP_RULE_BADGES[rule.kind]);

      continue;
    }

    if (rule.kind === "exclusive" || rule.kind === "together") {
      const prefix = rule.kind === "exclusive" ? "conflicts" : "with";
      for (const ref of rule.targets) {
        const others = rule.targets
          .filter((other) => other.kind !== ref.kind || other.name !== ref.name)
          .map(fmt);
        if (others.length > 0) {
          pushRefTag(ref, `${prefix}: ${others.join(", ")}`);
        }
      }

      continue;
    }

    const prefix = rule.kind === "oneOf" ? "one of" : "at least one";
    const listText = rule.targets.map(fmt).join(", ");
    for (const ref of rule.targets) {
      pushRefTag(ref, `${prefix}: ${listText}`);
    }
  }

  return { flagTags, argTags, groupTags };
}

function groupItems<T, R>(
  items: readonly T[],
  getGroup: (item: T) => string | undefined,
  mapItem: (item: T) => R,
  groups: readonly GroupDefinition[],
  ungroupedTitle: string,
  groupsFirst: boolean,
  groupTags?: ReadonlyMap<string, readonly string[]>,
  groupedFallbackTitle?: string,
): {
  readonly title: string;
  readonly tags?: readonly string[];
  readonly items: readonly R[];
}[] {
  if (items.length === 0) {
    return [];
  }

  const ungrouped: R[] = [];
  const buckets = new Map<string, R[]>();
  for (const item of items) {
    const key = getGroup(item);
    const mapped = mapItem(item);
    if (key) {
      let list = buckets.get(key);
      if (!list) {
        list = [];
        buckets.set(key, list);
      }
      list.push(mapped);
    } else {
      ungrouped.push(mapped);
    }
  }

  const titleByKey = new Map(groups.map((g) => [g.key, g.title]));
  const orderedKeys = new Set([...titleByKey.keys(), ...buckets.keys()]);
  const groupSections: {
    readonly title: string;
    readonly tags?: readonly string[];
    readonly items: readonly R[];
  }[] = [];

  for (const key of orderedKeys) {
    const list = buckets.get(key);
    if (list && list.length > 0) {
      const tags = groupTags?.get(key);
      groupSections.push({
        title: titleByKey.get(key) ?? key,
        ...(tags?.length ? { tags } : {}),
        items: list,
      });
    }
  }

  const fallbackTitle =
    groupSections.length > 0 && groupedFallbackTitle
      ? groupedFallbackTitle
      : ungroupedTitle;
  const ungroupedSection =
    ungrouped.length > 0 ? [{ title: fallbackTitle, items: ungrouped }] : [];

  return groupsFirst
    ? [...groupSections, ...ungroupedSection]
    : [...ungroupedSection, ...groupSections];
}

function buildUsage(
  node: CommandNode,
  name: string,
  hasVisibleChildren: boolean,
  hasOptions: boolean,
  hasDefaultCommand: boolean,
): HelpUsage {
  const command = node.command;
  const argTokens = command?.argTokens ?? [];
  const hasRequiredAfterDd = node.args.some(
    (a) => a.afterDoubleDash && a.isRequired,
  );

  const args: HelpUsageArg[] = argTokens.map((token) =>
    token === DOUBLE_DASH
      ? {
          text: hasRequiredAfterDd ? DOUBLE_DASH : `[${DOUBLE_DASH}]`,
          kind: "double-dash",
          optional: !hasRequiredAfterDd,
        }
      : {
          text: token,
          kind: "arg",
          optional: token.startsWith("["),
        },
  );

  return {
    command:
      node.fullPath.length > 0 ? `${name} ${node.fullPath.join(" ")}` : name,
    subcommand: hasVisibleChildren
      ? command?.run || hasDefaultCommand
        ? "optional"
        : "required"
      : "none",
    hasOptions,
    args,
  };
}

export function formatCommandUsage(
  model: CliModel,
  commandPath: readonly string[],
): string | undefined {
  const node =
    commandPath.length > 0 ? model.tree.findNode(commandPath) : model.tree.root;
  if (!node) {
    return undefined;
  }

  const visibleChildren = model.tree.listVisibleChildren(node);
  const hasVisibleFlags = getCommandFlags(model, node, {
    includeBuiltins: true,
  }).some((f) => !f.hidden);

  const usage = buildUsage(
    node,
    model.meta.name,
    visibleChildren.length > 0,
    hasVisibleFlags,
    Boolean(node.defaultChild),
  );
  const parts = [usage.command];
  if (usage.subcommand === "required") {
    parts.push("<command>");
  } else if (usage.subcommand === "optional") {
    parts.push("[command]");
  }
  if (usage.hasOptions) {
    parts.push("[options]");
  }
  for (const arg of usage.args) {
    parts.push(arg.text);
  }

  return parts.join(" ");
}

function resolveNodeGroup(
  node: CommandNode,
  tree: CommandTree,
): string | undefined {
  if (node.command?.group) {
    return node.command.group;
  }
  const children = tree.listVisibleChildren(node);
  if (children.length === 0) {
    return undefined;
  }
  const first = resolveNodeGroup(children[0], tree);
  if (!first) {
    return undefined;
  }

  return children.every((child) => resolveNodeGroup(child, tree) === first)
    ? first
    : undefined;
}

export async function buildHelpDocument(
  model: CliModel,
  node: CommandNode = model.tree.root,
): Promise<HelpDocument> {
  const { meta, tree, globalFlags, groups } = model;
  const command = node.command;
  const isRoot = node.fullPath.length === 0;
  const visibleChildren = tree.listVisibleChildren(node);
  const orderedChildren = [
    ...visibleChildren.filter((child) => !child.command?.builtin),
    ...visibleChildren.filter((child) => Boolean(child.command?.builtin)),
  ];

  const visibleLocalFlags = node.localFlags.filter((f) => !f.hidden);
  const localNames = new Set(node.localFlags.map((f) => f.name));
  const isStandalone = Boolean(command?.standalone);
  const visibleGlobalFlags = [
    ...(isStandalone
      ? []
      : globalFlags.filter((f) => !f.hidden && !localNames.has(f.name))),
    ...node.builtinFlags.filter((f) => !f.hidden),
  ];
  const hasCommandFlags = visibleLocalFlags.length > 0;
  const hasGlobalFlags = visibleGlobalFlags.length > 0;

  const examplesSource =
    command?.examples ?? (isRoot ? meta.examples : undefined);
  const rawExamples = examplesSource
    ? await resolveAsyncValue(examplesSource, meta)
    : [];

  const notesSource = command?.notes ?? (isRoot ? meta.notes : undefined);
  const rawNotes = notesSource
    ? await resolveAsyncValue(notesSource, meta)
    : [];
  const notes = [...rawNotes, ...node.ruleNotes];

  const flagMap = new Map<string, FlagDescriptor>(
    getCommandFlags(model, node).map((f) => [f.name, f]),
  );
  const argMap = new Map<string, ArgDescriptor>(
    node.args.map((a) => [a.name, a]),
  );
  const visibleFlagGroups = new Set(
    [...visibleLocalFlags, ...visibleGlobalFlags]
      .map((f) => f.group)
      .filter((g): g is string => Boolean(g)),
  );
  const flagGroupTitles = new Map(
    [...groups.flags, ...groups.globalFlags].map((g) => [g.key, g.title]),
  );
  const { flagTags, argTags, groupTags } = collectRuleAnnotations(
    node.rules,
    flagMap,
    argMap,
    visibleFlagGroups,
    flagGroupTitles,
  );

  return {
    header: {
      name: meta.name,
      commandPath: node.fullPath,
      version: formatVersion(meta.version),
      description: isRoot
        ? (command?.description ?? (meta.description || undefined))
        : command?.description,
      aliases: node.aliases,
    },
    usage: buildUsage(
      node,
      meta.name,
      visibleChildren.length > 0,
      hasCommandFlags || hasGlobalFlags,
      Boolean(node.defaultChild),
    ),
    arguments: node.args.map((arg) =>
      buildArgumentItem(arg, argTags.get(arg.name)),
    ),
    commandGroups: groupItems(
      orderedChildren,
      (child) => resolveNodeGroup(child, tree),
      (child) => ({
        name: child.name,
        aliases: child.aliases,
        description: child.command?.description,
        isDefault: child === node.defaultChild,
        deprecated: child.command?.deprecated,
      }),
      groups.commands,
      isRoot ? "Commands" : "Subcommands",
      true,
      undefined,
      isRoot ? "Other Commands" : "Other Subcommands",
    ),
    optionGroups: hasCommandFlags
      ? groupItems(
          visibleLocalFlags,
          (f) => f.group,
          (f) => buildOptionItem(f, flagTags.get(f.name)),
          groups.flags,
          "Options",
          false,
          groupTags,
        )
      : [],
    globalOptionGroups: hasGlobalFlags
      ? groupItems(
          visibleGlobalFlags,
          (f) => f.group,
          (f) => buildOptionItem(f, flagTags.get(f.name)),
          groups.globalFlags,
          hasCommandFlags ? "Global Options" : "Options",
          false,
          groupTags,
        )
      : [],
    examples: rawExamples.map((entry) =>
      typeof entry === "string"
        ? { command: entry }
        : {
            command: entry[0],
            description: entry[1]?.length ? entry[1] : undefined,
          },
    ),
    notes,
  };
}
