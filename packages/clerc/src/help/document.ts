import { splitArgTokens } from "../args";
import { DOUBLE_DASH } from "../parser";
import type {
  ArgDescriptor,
  CliModel,
  CommandNode,
  FlagDescriptor,
  GroupDefinition,
} from "../types";
import {
  formatFlagName,
  formatVersion,
  resolveAsyncValue,
  toArray,
} from "../utils";

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
}

export interface HelpOptionGroup {
  readonly title: string;
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

export function formatDefaultValue(value: unknown): string {
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

function buildOptionItem(flag: FlagDescriptor): HelpOptionItem {
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
  };
}

const buildArgumentItem = (arg: ArgDescriptor): HelpArgumentItem => ({
  name: arg.name,
  token: arg.token,
  typeLabel: arg.placeholder ?? arg.display,
  description: arg.description,
  defaultText:
    arg.default === undefined ? undefined : formatDefaultValue(arg.default),
  env: arg.env,
  required: arg.isRequired,
  variadic: arg.isVariadic,
});

function groupItems<T, R>(
  items: readonly T[],
  getGroup: (item: T) => string | undefined,
  mapItem: (item: T) => R,
  groups: readonly GroupDefinition[],
  ungroupedTitle: string,
  groupsFirst: boolean,
): { readonly title: string; readonly items: readonly R[] }[] {
  if (items.length === 0) {
    return [];
  }

  const ungrouped: R[] = [];
  const buckets = new Map<string, R[]>();
  for (const item of items) {
    const key = getGroup(item);
    const mapped = mapItem(item);
    if (key) {
      const list = buckets.get(key) ?? [];
      list.push(mapped);
      buckets.set(key, list);
    } else {
      ungrouped.push(mapped);
    }
  }

  const titleByKey = new Map(groups.map((g) => [g.key, g.title]));
  const orderedKeys = new Set([...titleByKey.keys(), ...buckets.keys()]);
  const groupSections: {
    readonly title: string;
    readonly items: readonly R[];
  }[] = [];

  for (const key of orderedKeys) {
    const list = buckets.get(key);
    if (list && list.length > 0) {
      groupSections.push({ title: titleByKey.get(key) ?? key, items: list });
    }
  }

  const ungroupedSection =
    ungrouped.length > 0 ? [{ title: ungroupedTitle, items: ungrouped }] : [];

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
  const { doubleDash } = splitArgTokens(argTokens);
  const hasRequiredAfterDd = doubleDash.some((t) => t.startsWith("<"));

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
  const localFlagNames = new Set(node.localFlags.map((f) => f.name));
  const visibleGlobalFlags = [
    ...globalFlags.filter((f) => !f.hidden && !localFlagNames.has(f.name)),
    ...node.builtinFlags.filter((f) => !f.hidden),
  ];
  const hasCommandFlags = visibleLocalFlags.length > 0;
  const hasGlobalFlags = visibleGlobalFlags.length > 0;

  const aliases = command?.aliases ? toArray(command.aliases) : [];

  const examplesSource =
    command?.examples ?? (isRoot ? meta.examples : undefined);
  const rawExamples = examplesSource
    ? await resolveAsyncValue(examplesSource, meta)
    : [];

  const notesSource = command?.notes ?? (isRoot ? meta.notes : undefined);
  const notes = notesSource ? await resolveAsyncValue(notesSource, meta) : [];

  return {
    header: {
      name: meta.name,
      commandPath: node.fullPath,
      version: formatVersion(meta.version),
      description: isRoot
        ? (command?.description ?? (meta.description || undefined))
        : command?.description,
      aliases,
    },
    usage: buildUsage(
      node,
      meta.name,
      visibleChildren.length > 0,
      hasCommandFlags || hasGlobalFlags,
      isRoot && Boolean(model.defaultCommand),
    ),
    arguments: node.args.map(buildArgumentItem),
    commandGroups: groupItems(
      orderedChildren,
      (child) => child.command?.group,
      (child) => ({
        name: child.name,
        aliases: child.command?.aliases ? toArray(child.command.aliases) : [],
        description: child.command?.description,
        isDefault:
          child.fullPath.length === model.defaultCommand?.length &&
          child.fullPath.every(
            (seg, idx) => seg === model.defaultCommand![idx],
          ),
        deprecated: child.command?.deprecated,
      }),
      groups.commands,
      isRoot ? "Commands" : "Subcommands",
      true,
    ),
    optionGroups: hasCommandFlags
      ? groupItems(
          visibleLocalFlags,
          (f) => f.group,
          buildOptionItem,
          groups.flags,
          "Options",
          false,
        )
      : [],
    globalOptionGroups: hasGlobalFlags
      ? groupItems(
          visibleGlobalFlags,
          (f) => f.group,
          buildOptionItem,
          groups.globalFlags,
          hasCommandFlags ? "Global Options" : "Options",
          false,
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
