import { resolveCommandArgs, splitArgTokens } from "../args";
import { normalizeFlagValue } from "../flags";
import { DOUBLE_DASH } from "../parser";
import type { TypeDescriptor } from "../schema";
import { describeType } from "../schema";
import type { Theme } from "../theme";
import type {
  AnyCommandDefinition,
  ClercFlagOptions,
  ClercFlagsDefinition,
  CommandNode,
  GroupDefinition,
  MetaAsyncGetter,
  ReadonlyCliMeta,
  ReadonlyCliModel,
} from "../types";
import {
  formatFlagName,
  formatVersion,
  resolveAsyncValue,
  toArray,
} from "../utils";
import type { TwoColumnRow } from "./layout";
import { formatTwoColumn, measureColumnWidth } from "./layout";

export interface RenderHelpOptions {
  readonly node?: CommandNode;
  readonly theme: Theme;
  readonly columns?: number;
  readonly unicode?: boolean;
  readonly header?: MetaAsyncGetter<string | undefined | void>;
  readonly footer?: MetaAsyncGetter<string | undefined | void>;
}

interface TableSection {
  readonly title: string;
  readonly rows: readonly TwoColumnRow[];
}

const MAX_RULE_WIDTH = 72;
const SNAP_MAX_COL_WIDTH = 24;
const SNAP_MAX_DIFF = 10;

function formatPlaceholder(
  flag: ClercFlagOptions,
  desc: TypeDescriptor,
): string | undefined {
  if (flag.placeholder) {
    return flag.placeholder;
  }

  return desc.kind === "boolean" || desc.kind === "counter"
    ? undefined
    : `<${desc.display}>`;
}

function formatDefault(value: unknown): string {
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

function formatFlagRow(
  name: string,
  flag: ClercFlagOptions,
  theme: Theme,
  hasAnyShort: boolean,
): TwoColumnRow {
  const longName = formatFlagName(name);
  const base = flag.short
    ? `${theme.flag(`-${flag.short}`)}${theme.muted(", ")}${theme.flag(longName)}`
    : `${hasAnyShort ? "    " : ""}${theme.flag(longName)}`;
  const desc = describeType(flag.type);
  const aliasNames = flag.aliases
    ? toArray(flag.aliases)
        .filter((a) => a.length > 0)
        .map((a) => `${theme.muted(", ")}${theme.flag(formatFlagName(a))}`)
        .join("")
    : "";
  const negated =
    desc.kind === "boolean" && flag.negatable !== false && flag.default === true
      ? `${theme.muted(", ")}${theme.flag(`--no-${longName.slice(2)}`)}`
      : "";
  const placeholder = formatPlaceholder(flag, desc);
  const placeholderPart = placeholder
    ? flag.implicitValue === undefined
      ? ` ${theme.placeholder(placeholder)}`
      : theme.placeholder(`[=${placeholder}]`)
    : "";
  const left = `${base}${aliasNames}${negated}${placeholderPart}`;

  const metaTags: string[] = [];
  if (flag.required) {
    metaTags.push(theme.muted("[required]"));
  }
  if (
    flag.default !== undefined &&
    (desc.kind !== "boolean" || flag.default !== false)
  ) {
    metaTags.push(theme.muted(`[default: ${formatDefault(flag.default)}]`));
  }
  if (flag.env) {
    metaTags.push(theme.muted(`[env: ${flag.env}]`));
  }
  if (flag.deprecated) {
    const label =
      typeof flag.deprecated === "string"
        ? `[deprecated: ${flag.deprecated}]`
        : "[deprecated]";
    metaTags.push(theme.warn(label));
  }

  const right = [flag.description, metaTags.join(" ")]
    .filter(Boolean)
    .join("  ");

  return [left, right];
}

const formatSection = (
  heading: string,
  lines: readonly string[],
  theme: Theme,
): string | undefined =>
  lines.length > 0
    ? `${theme.heading(heading.toUpperCase())}\n${lines.join("\n")}`
    : undefined;

function renderHeader(
  node: CommandNode,
  meta: ReadonlyCliMeta,
  theme: Theme,
): string {
  const isRoot = node.fullPath.length === 0;
  const command = node.command;
  const titleLeft = isRoot
    ? theme.brand(meta.scriptName)
    : `${theme.muted(meta.scriptName)} ${theme.brand(node.fullPath.join(" "))}`;
  const versionText = formatVersion(meta.version);
  const aliases = command?.aliases
    ? toArray(command.aliases).filter((a) => a.length > 0)
    : [];
  const aliasPart =
    aliases.length > 0
      ? theme.muted(
          `${aliases.length > 1 ? "aliases" : "alias"}: ${aliases.join(", ")}`,
        )
      : undefined;

  const titleParts = [
    titleLeft,
    versionText ? theme.muted(versionText) : undefined,
  ].filter(Boolean);
  const firstLine = aliasPart
    ? `${titleParts.join(" ")}  ${aliasPart}`
    : titleParts.join(" ");

  const description = isRoot
    ? (command?.description ?? meta.description)
    : command?.description;

  return description ? `${firstLine}\n${description}` : firstLine;
}

function renderUsageLine(
  node: CommandNode,
  meta: ReadonlyCliMeta,
  hasVisibleChildren: boolean,
  hasOptions: boolean,
  theme: Theme,
): string {
  const command = node.command;
  const argTokens = command?.argTokens ?? [];
  const { doubleDash } = splitArgTokens(argTokens);
  const hasRequiredAfterDd = doubleDash.some((t) => t.startsWith("<"));

  const displayArgs = argTokens.map((t) => {
    if (t === DOUBLE_DASH) {
      return theme.muted(hasRequiredAfterDd ? DOUBLE_DASH : `[${DOUBLE_DASH}]`);
    }

    return theme.placeholder(t);
  });

  const cmdTitle =
    node.fullPath.length > 0
      ? `${meta.scriptName} ${node.fullPath.join(" ")}`
      : meta.scriptName;

  const parts = [
    theme.command(cmdTitle),
    hasVisibleChildren
      ? command?.run
        ? theme.muted("[command]")
        : theme.placeholder("<command>")
      : "",
    hasOptions ? theme.muted("[options]") : "",
    ...displayArgs,
  ].filter(Boolean);

  return `${theme.heading("USAGE")}   ${parts.join(" ")}`;
}

function buildArgumentRows(
  command: AnyCommandDefinition | undefined,
  theme: Theme,
): TwoColumnRow[] {
  if (!command) {
    return [];
  }

  return resolveCommandArgs(command).map((arg) => {
    const typeLabel =
      arg.options.placeholder ??
      (arg.options.type ? describeType(arg.options.type).display : undefined);
    const left = typeLabel
      ? `${theme.command(arg.token)} ${theme.placeholder(`<${typeLabel}>`)}`
      : theme.command(arg.token);

    const metaTags: string[] = [];
    if (arg.options.default !== undefined) {
      metaTags.push(
        theme.muted(`[default: ${formatDefault(arg.options.default)}]`),
      );
    }
    if (arg.options.env) {
      metaTags.push(theme.muted(`[env: ${arg.options.env}]`));
    }
    const right = [arg.options.description, metaTags.join(" ")]
      .filter(Boolean)
      .join("  ");

    return [left, right] as const;
  });
}

function buildGroupedSections<T>(
  items: readonly T[],
  getGroup: (item: T) => string | undefined,
  toRows: (list: readonly T[]) => TwoColumnRow[],
  groups: readonly GroupDefinition[],
  ungroupedTitle: string,
  groupsFirst: boolean,
): TableSection[] {
  if (items.length === 0) {
    return [];
  }

  const ungrouped: T[] = [];
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const key = getGroup(item);
    if (key) {
      const list = buckets.get(key) ?? [];
      list.push(item);
      buckets.set(key, list);
    } else {
      ungrouped.push(item);
    }
  }

  const titleByKey = new Map(groups.map((g) => [g.key, g.title]));
  const orderedKeys = new Set([...titleByKey.keys(), ...buckets.keys()]);
  const groupSections: TableSection[] = [];
  for (const key of orderedKeys) {
    const list = buckets.get(key);
    if (!list || list.length === 0) {
      continue;
    }
    groupSections.push({
      title: titleByKey.get(key) ?? key,
      rows: toRows(list),
    });
  }

  const ungroupedSection: TableSection[] =
    ungrouped.length > 0
      ? [{ title: ungroupedTitle, rows: toRows(ungrouped) }]
      : [];

  return groupsFirst
    ? [...groupSections, ...ungroupedSection]
    : [...ungroupedSection, ...groupSections];
}

function buildCommandSections(
  children: readonly CommandNode[],
  groups: readonly GroupDefinition[],
  isRoot: boolean,
  theme: Theme,
): TableSection[] {
  const ordered = [
    ...children.filter((node) => !node.command?.builtin),
    ...children.filter((node) => Boolean(node.command?.builtin)),
  ];

  return buildGroupedSections(
    ordered,
    (node) => node.command?.group,
    (list) =>
      list.map((node) => {
        const aliases = node.command?.aliases
          ? toArray(node.command.aliases).filter((a) => a.length > 0)
          : [];
        const aliasTag =
          aliases.length > 0
            ? ` ${theme.muted(`(${aliases.join(", ")})`)}`
            : "";
        const depTag = node.command?.deprecated
          ? `  ${theme.warn("[deprecated]")}`
          : "";

        return [
          `${theme.command(node.name)}${aliasTag}`,
          `${node.command?.description ?? ""}${depTag}`.trim(),
        ] as const;
      }),
    groups,
    isRoot ? "Commands" : "Subcommands",
    true,
  );
}

type FlagEntry = readonly [name: string, options: ClercFlagOptions];

function getVisibleFlagEntries(
  flags: Readonly<ClercFlagsDefinition> | undefined,
): FlagEntry[] {
  if (!flags) {
    return [];
  }

  const entries = Object.entries(flags)
    .map(([name, def]) => [name, normalizeFlagValue(def)] as const)
    .filter(([, norm]) => !norm.hidden);

  return [
    ...entries.filter(([, norm]) => !norm.builtin),
    ...entries.filter(([, norm]) => Boolean(norm.builtin)),
  ];
}

const buildFlagSections = (
  entries: readonly FlagEntry[],
  groups: readonly GroupDefinition[],
  ungroupedTitle: string,
  hasAnyShort: boolean,
  theme: Theme,
): TableSection[] =>
  buildGroupedSections(
    entries,
    ([, norm]) => norm.group,
    (list) =>
      list.map(([name, norm]) => formatFlagRow(name, norm, theme, hasAnyShort)),
    groups,
    ungroupedTitle,
    false,
  );

function highlightExampleCommand(cmd: string, theme: Theme): string {
  const leadMatch = /^\$\s+/.exec(cmd);
  const prompt = leadMatch ? theme.muted(leadMatch[0]) : "";
  const rest = leadMatch ? cmd.slice(leadMatch[0].length) : cmd;

  const highlighted = rest
    .split(/(\s+)/)
    .map((token) => {
      if (!token || /^\s+$/.test(token)) {
        return token;
      }
      if (token.startsWith("-") && token !== "-") {
        const eq = token.indexOf("=");
        if (eq > 1) {
          return `${theme.flag(token.slice(0, eq + 1))}${theme.placeholder(token.slice(eq + 1))}`;
        }

        return theme.flag(token);
      }
      if (
        (token.startsWith("<") && token.endsWith(">")) ||
        (token.startsWith("[") && token.endsWith("]"))
      ) {
        return theme.placeholder(token);
      }

      return token;
    })
    .join("");

  return `${prompt}${highlighted}`;
}

function renderExamples(
  examples: readonly (readonly [string, string])[],
  theme: Theme,
): string[] {
  if (examples.length === 0) {
    return [];
  }

  const lines: string[] = [];
  for (const [i, [cmd, desc]] of examples.entries()) {
    if (i > 0) {
      lines.push("");
    }
    if (desc) {
      lines.push(`  ${theme.muted(`# ${desc}`)}`);
    }
    lines.push(`  ${highlightExampleCommand(cmd, theme)}`);
  }

  return lines;
}

function resolveAlignedWidths(
  commandRows: readonly TwoColumnRow[],
  optionRows: readonly TwoColumnRow[],
  columns: number,
): { readonly commandColWidth: number; readonly optionColWidth: number } {
  const commandColWidth = measureColumnWidth(commandRows, {
    maxWidth: columns,
  });
  const optionColWidth = measureColumnWidth(optionRows, { maxWidth: columns });

  if (commandRows.length > 0 && optionRows.length > 0) {
    const maxW = Math.max(commandColWidth, optionColWidth);
    const diff = Math.abs(commandColWidth - optionColWidth);
    if (maxW <= SNAP_MAX_COL_WIDTH && diff <= SNAP_MAX_DIFF) {
      return { commandColWidth: maxW, optionColWidth: maxW };
    }
  }

  return { commandColWidth, optionColWidth };
}

export async function renderHelp(
  model: ReadonlyCliModel,
  options: RenderHelpOptions,
): Promise<string> {
  const { meta, tree, globalFlags, groups } = model;
  const { theme, columns = 80, unicode = true, node = tree.root } = options;
  const command = node.command;
  const isRoot = node.fullPath.length === 0;
  const visibleChildren = tree.listVisibleChildren(node);
  const commandFlagEntries = getVisibleFlagEntries(command?.flags);
  const globalFlagEntries = getVisibleFlagEntries(globalFlags);
  const hasCommandFlags = commandFlagEntries.length > 0;
  const hasGlobalFlags = globalFlagEntries.length > 0;
  const hasAnyShort = [...commandFlagEntries, ...globalFlagEntries].some(
    ([, norm]) => Boolean(norm.short),
  );

  const examplesSource =
    command?.examples ?? (isRoot ? meta.examples : undefined);
  const examples = examplesSource
    ? await resolveAsyncValue(examplesSource, meta)
    : [];

  const notesSource = command?.notes ?? (isRoot ? meta.notes : undefined);
  const notes = notesSource ? await resolveAsyncValue(notesSource, meta) : [];

  const argRows = buildArgumentRows(command, theme);
  const commandSections = buildCommandSections(
    visibleChildren,
    groups.commands,
    isRoot,
    theme,
  );
  const commandFlagSections = hasCommandFlags
    ? buildFlagSections(
        commandFlagEntries,
        groups.flags,
        "Options",
        hasAnyShort,
        theme,
      )
    : [];
  const globalFlagSections = hasGlobalFlags
    ? buildFlagSections(
        globalFlagEntries,
        groups.globalFlags,
        hasCommandFlags ? "Global Options" : "Options",
        hasAnyShort,
        theme,
      )
    : [];

  const allCommandRows = commandSections.flatMap((s) => s.rows);
  const allOptionRows = [
    ...argRows,
    ...commandFlagSections.flatMap((s) => s.rows),
    ...globalFlagSections.flatMap((s) => s.rows),
  ];

  const { commandColWidth, optionColWidth } = resolveAlignedWidths(
    allCommandRows,
    allOptionRows,
    columns,
  );
  const gap = columns >= 90 ? 4 : 3;
  const formatCommands = (rows: readonly TwoColumnRow[]): string[] =>
    formatTwoColumn(rows, {
      indent: 2,
      gap,
      maxWidth: columns,
      colWidth: commandColWidth,
    });
  const formatOptions = (rows: readonly TwoColumnRow[]): string[] =>
    formatTwoColumn(rows, {
      indent: 2,
      gap,
      maxWidth: columns,
      colWidth: optionColWidth,
    });

  const ruleChar = unicode ? "─" : "-";
  const topRule = theme.muted(
    ruleChar.repeat(Math.min(columns, MAX_RULE_WIDTH)),
  );
  const headerBlock = [
    renderHeader(node, meta, theme),
    topRule,
    renderUsageLine(
      node,
      meta,
      visibleChildren.length > 0,
      hasCommandFlags || hasGlobalFlags,
      theme,
    ),
  ].join("\n");

  const blocks = [
    options.header ? await resolveAsyncValue(options.header, meta) : undefined,
    headerBlock,
    formatSection("Arguments", formatOptions(argRows), theme),
    ...commandSections.map((section) =>
      formatSection(section.title, formatCommands(section.rows), theme),
    ),
    ...commandFlagSections.map((section) =>
      formatSection(section.title, formatOptions(section.rows), theme),
    ),
    ...globalFlagSections.map((section) =>
      formatSection(section.title, formatOptions(section.rows), theme),
    ),
    formatSection("Examples", renderExamples(examples, theme), theme),
    formatSection(
      "Notes",
      notes.map((n) => `  ${theme.muted(n)}`),
      theme,
    ),
    options.footer ? await resolveAsyncValue(options.footer, meta) : undefined,
  ];

  return blocks.filter(Boolean).join("\n\n");
}
