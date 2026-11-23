import { DOUBLE_DASH } from "@clerc/parser";

import { resolveCommandArgs, splitArgTokens } from "../args";
import { normalizeFlagValue } from "../flags";
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
import { formatTwoColumn } from "./layout";

export interface RenderHelpOptions {
  readonly node?: CommandNode;
  readonly theme: Theme;
  readonly columns?: number;
  readonly header?: MetaAsyncGetter<string | undefined | void>;
  readonly footer?: MetaAsyncGetter<string | undefined | void>;
}

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

  return JSON.stringify(value);
}

function formatFlagRow(
  name: string,
  flag: ClercFlagOptions,
  theme: Theme,
  hasAnyShort: boolean,
): [string, string] {
  const longName = formatFlagName(name);
  const base = flag.short
    ? theme.flag(`-${flag.short}, ${longName}`)
    : `${hasAnyShort ? "    " : ""}${theme.flag(longName)}`;
  const desc = describeType(flag.type);
  const negated =
    desc.kind === "boolean" && flag.negatable !== false && flag.default === true
      ? `, ${theme.flag(`--no-${longName.slice(2)}`)}`
      : "";
  const placeholder = formatPlaceholder(flag, desc);
  const left = `${base}${negated}${placeholder ? ` ${theme.placeholder(placeholder)}` : ""}`;

  const tags: string[] = [];
  if (flag.required) {
    tags.push("required");
  }
  if (
    flag.default !== undefined &&
    (desc.kind !== "boolean" || flag.default !== false)
  ) {
    tags.push(`default: ${formatDefault(flag.default)}`);
  }
  if (flag.env) {
    tags.push(`env: ${flag.env}`);
  }

  const metaParts: string[] = [];
  if (tags.length > 0) {
    metaParts.push(theme.muted(`(${tags.join(", ")})`));
  }
  if (flag.deprecated) {
    const label =
      typeof flag.deprecated === "string"
        ? `[deprecated: ${flag.deprecated}]`
        : "[deprecated]";
    metaParts.push(theme.warn(label));
  }

  const right = [flag.description, metaParts.join(" ")]
    .filter(Boolean)
    .join("  ");

  return [left, right];
}

function renderGroupedRows<T>(
  items: readonly T[],
  getGroup: (item: T) => string | undefined,
  toRows: (list: readonly T[]) => [string, string][],
  groups: readonly GroupDefinition[],
  theme: Theme,
  columns: number,
): string[] {
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

  const lines: string[] =
    ungrouped.length > 0
      ? formatTwoColumn(toRows(ungrouped), { indent: 2, maxWidth: columns })
      : [];

  const titleByKey = new Map(groups.map((g) => [g.key, g.title]));
  const orderedKeys = new Set([...titleByKey.keys(), ...buckets.keys()]);

  for (const key of orderedKeys) {
    const list = buckets.get(key);
    if (!list || list.length === 0) {
      continue;
    }
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(`  ${theme.muted(`${titleByKey.get(key) ?? key}:`)}`);
    lines.push(
      ...formatTwoColumn(toRows(list), { indent: 4, maxWidth: columns }),
    );
  }

  return lines;
}

const formatSection = (
  heading: string,
  lines: readonly string[],
  theme: Theme,
): string | undefined =>
  lines.length > 0
    ? `${theme.heading(heading)}\n${lines.join("\n")}`
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
  const title = versionText
    ? `${titleLeft} ${theme.muted(versionText)}`
    : titleLeft;
  const description = isRoot
    ? (command?.description ?? meta.description)
    : command?.description;

  const lines = [
    description ? `${title} ${theme.muted("—")} ${description}` : title,
  ];
  const aliases = command?.aliases
    ? toArray(command.aliases).filter((a) => a.length > 0)
    : [];
  if (aliases.length > 0) {
    const label = aliases.length > 1 ? "Aliases:" : "Alias:";
    lines.push(
      `${theme.muted(label)} ${aliases.map((a) => theme.command(a)).join(", ")}`,
    );
  }

  return lines.join("\n");
}

function renderUsage(
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

  const displayArgs = argTokens.map((t) =>
    t === DOUBLE_DASH
      ? hasRequiredAfterDd
        ? DOUBLE_DASH
        : `[${DOUBLE_DASH}]`
      : t,
  );

  const parts = [
    meta.scriptName,
    node.fullPath.length > 0 ? node.fullPath.join(" ") : "",
    hasVisibleChildren ? theme.muted(command ? "[command]" : "<command>") : "",
    hasOptions ? theme.muted("[options]") : "",
    ...displayArgs,
  ].filter(Boolean);

  return `  ${parts.join(" ")}`;
}

function renderArguments(
  command: AnyCommandDefinition | undefined,
  theme: Theme,
  columns: number,
): string[] {
  if (!command) {
    return [];
  }
  const rows: [string, string][] = resolveCommandArgs(command).map((arg) => {
    const typeLabel =
      arg.options.placeholder ??
      (arg.options.type ? describeType(arg.options.type).display : undefined);
    const left = typeLabel
      ? `${theme.command(arg.token)} ${theme.placeholder(`<${typeLabel}>`)}`
      : theme.command(arg.token);

    return [left, arg.options.description ?? ""];
  });

  return formatTwoColumn(rows, { indent: 2, maxWidth: columns });
}

const renderCommands = (
  children: readonly CommandNode[],
  groups: readonly GroupDefinition[],
  theme: Theme,
  columns: number,
): string[] =>
  renderGroupedRows(
    children,
    (node) => node.command?.group,
    (list) =>
      list.map((node) => {
        const aliases = node.command?.aliases
          ? toArray(node.command.aliases)
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
        ];
      }),
    groups,
    theme,
    columns,
  );

function renderFlags(
  flags: Readonly<ClercFlagsDefinition>,
  groups: readonly GroupDefinition[],
  theme: Theme,
  columns: number,
): string[] {
  const entries = Object.entries(flags)
    .map(([name, def]) => [name, normalizeFlagValue(def)] as const)
    .filter(([, norm]) => !norm.hidden);

  return renderGroupedRows(
    entries,
    ([, norm]) => norm.group,
    (list) => {
      const hasShort = list.some(([, norm]) => Boolean(norm.short));

      return list.map(([name, norm]) =>
        formatFlagRow(name, norm, theme, hasShort),
      );
    },
    groups,
    theme,
    columns,
  );
}

export async function renderHelp(
  model: ReadonlyCliModel,
  options: RenderHelpOptions,
): Promise<string> {
  const { meta, tree, globalFlags, groups } = model;
  const { theme, columns = 80, node = tree.root } = options;
  const command = node.command;
  const isRoot = node.fullPath.length === 0;
  const visibleChildren = tree.listVisibleChildren(node);
  const hasCommandFlags = Boolean(
    command?.flags && Object.keys(command.flags).length > 0,
  );
  const hasGlobalFlags = Object.keys(globalFlags).length > 0;

  const examplesSource =
    command?.examples ?? (isRoot ? meta.examples : undefined);
  const examples = examplesSource
    ? await resolveAsyncValue(examplesSource, meta)
    : [];

  const notesSource = command?.notes ?? (isRoot ? meta.notes : undefined);
  const notes = notesSource ? await resolveAsyncValue(notesSource, meta) : [];

  const blocks = [
    options.header ? await resolveAsyncValue(options.header, meta) : undefined,
    renderHeader(node, meta, theme),
    formatSection(
      "Usage:",
      [
        renderUsage(
          node,
          meta,
          visibleChildren.length > 0,
          hasCommandFlags || hasGlobalFlags,
          theme,
        ),
      ],
      theme,
    ),
    formatSection(
      "Arguments:",
      renderArguments(command, theme, columns),
      theme,
    ),
    formatSection(
      isRoot ? "Commands:" : "Subcommands:",
      renderCommands(visibleChildren, groups.commands, theme, columns),
      theme,
    ),
    hasCommandFlags
      ? formatSection(
          "Options:",
          renderFlags(command!.flags, groups.flags, theme, columns),
          theme,
        )
      : undefined,
    hasGlobalFlags
      ? formatSection(
          hasCommandFlags ? "Global Options:" : "Options:",
          renderFlags(globalFlags, groups.globalFlags, theme, columns),
          theme,
        )
      : undefined,
    formatSection(
      "Examples:",
      formatTwoColumn(
        examples.map(
          ([cmd, desc]) => [theme.accent(cmd), theme.muted(desc)] as const,
        ),
        { indent: 2, gap: 4, maxWidth: columns },
      ),
      theme,
    ),
    formatSection(
      "Notes:",
      notes.map((n) => `  ${n}`),
      theme,
    ),
    options.footer ? await resolveAsyncValue(options.footer, meta) : undefined,
  ];

  return blocks.filter(Boolean).join("\n\n");
}
