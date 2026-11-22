import type {
  ClercFlagOptions,
  ClercFlagsDefinition,
  CommandNode,
  CoreTypeValue,
  GroupDefinition,
  MaybeAsyncGetter,
  ParameterDefinitionValue,
  ReadonlyCliModel,
  Theme,
} from "@clerc/core";
import {
  DOUBLE_DASH,
  UnknownCommandError,
  definePlugin,
  formatFlagName,
  formatVersion,
  isStandardSchema,
  normalizeFlagValue,
  normalizeParameterValue,
  resolveAsyncValue,
  toArray,
} from "@clerc/core";

import { formatTwoColumn } from "./layout";

export interface HelpGroupsOptions {
  readonly commands?: readonly GroupDefinition[];
  readonly flags?: readonly GroupDefinition[];
  readonly globalFlags?: readonly GroupDefinition[];
}

export interface HelpPluginOptions<Flag extends boolean = true> {
  readonly command?: boolean;
  readonly flag?: Flag;
  readonly showHelpWhenNoCommandSpecified?: boolean;
  readonly header?: MaybeAsyncGetter<string | undefined | void>;
  readonly footer?: MaybeAsyncGetter<string | undefined | void>;
  readonly examples?: MaybeAsyncGetter<readonly (readonly [string, string])[]>;
  readonly notes?: MaybeAsyncGetter<readonly string[]>;
  readonly groups?: HelpGroupsOptions;
}

export interface RenderHelpOptions {
  readonly node?: CommandNode;
  readonly theme: Theme;
  readonly columns?: number;
  readonly groups?: HelpGroupsOptions;
  readonly examples?: MaybeAsyncGetter<readonly (readonly [string, string])[]>;
  readonly notes?: MaybeAsyncGetter<readonly string[]>;
}

const HELP_GLOBAL_FLAGS = {
  help: {
    type: Boolean,
    short: "h",
    description: "Show help",
  },
} as const;

function formatSingleTypeName(type: unknown): string {
  if (isStandardSchema(type)) {
    return "value";
  }
  if (typeof type === "function") {
    if ("display" in type && typeof type.display === "string") {
      return type.display;
    }
    if (type === String) {
      return "string";
    }
    if (type === Number) {
      return "number";
    }
    if (type === Boolean) {
      return "boolean";
    }
    if (type === Object) {
      return "key=value";
    }

    return type.name ? type.name.toLowerCase() : "value";
  }

  return "value";
}

function formatPlaceholder(flag: ClercFlagOptions): string | undefined {
  if (flag.placeholder) {
    return flag.placeholder;
  }

  const type: CoreTypeValue = flag.type;
  if (type === Boolean) {
    return undefined;
  }
  if (Array.isArray(type)) {
    const inner = type[0];
    if (inner === Boolean) {
      return undefined;
    }

    return `<${formatSingleTypeName(inner)}...>`;
  }

  return `<${formatSingleTypeName(type)}>`;
}

function formatDefaultValue(value: unknown): string {
  if (
    typeof value === "function" &&
    "display" in value &&
    typeof value.display === "string"
  ) {
    return value.display;
  }

  return JSON.stringify(value);
}

function buildFlagSignature(
  name: string,
  flag: ClercFlagOptions,
  theme: Theme,
  hasAnyShort: boolean,
): string {
  const longName = formatFlagName(name);
  const isNegatableDefaultTrue =
    flag.type === Boolean && flag.negatable !== false && flag.default === true;

  let flagPart: string;
  if (flag.short) {
    flagPart = theme.flag(`-${flag.short}, ${longName}`);
  } else if (hasAnyShort) {
    flagPart = `    ${theme.flag(longName)}`;
  } else {
    flagPart = theme.flag(longName);
  }

  if (isNegatableDefaultTrue) {
    flagPart += `, ${theme.flag(`--no-${longName.slice(2)}`)}`;
  }

  const placeholder = formatPlaceholder(flag);
  if (placeholder) {
    flagPart += ` ${theme.placeholder(placeholder)}`;
  }

  return flagPart;
}

function buildFlagMeta(flag: ClercFlagOptions, theme: Theme): string {
  const tags: string[] = [];

  if (flag.required) {
    tags.push("required");
  }

  if (
    flag.default !== undefined &&
    (flag.type !== Boolean || flag.default !== false)
  ) {
    tags.push(`default: ${formatDefaultValue(flag.default)}`);
  }

  if (flag.env) {
    tags.push(`env: ${flag.env}`);
  }

  const parts: string[] = [];
  if (tags.length > 0) {
    parts.push(theme.muted(`(${tags.join(", ")})`));
  }
  if (flag.deprecated) {
    const depText =
      typeof flag.deprecated === "string"
        ? `[deprecated: ${flag.deprecated}]`
        : "[deprecated]";
    parts.push(theme.warn(depText));
  }

  return parts.join(" ");
}

function renderGroupedSection<T>(
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
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    const groupKey = getGroup(item);
    if (groupKey) {
      const list = grouped.get(groupKey) ?? [];
      list.push(item);
      grouped.set(groupKey, list);
    } else {
      ungrouped.push(item);
    }
  }

  const lines: string[] = [];
  if (ungrouped.length > 0) {
    lines.push(
      ...formatTwoColumn(toRows(ungrouped), { indent: 2, maxWidth: columns }),
    );
  }

  function appendGroup(title: string, list: readonly T[]): void {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(`  ${theme.muted(`${title}:`)}`);
    lines.push(
      ...formatTwoColumn(toRows(list), { indent: 4, maxWidth: columns }),
    );
  }

  const seenGroups = new Set<string>();
  for (const g of groups) {
    const list = grouped.get(g.key);
    if (list && list.length > 0) {
      seenGroups.add(g.key);
      appendGroup(g.title, list);
    }
  }

  for (const [key, list] of grouped.entries()) {
    if (!seenGroups.has(key) && list.length > 0) {
      appendGroup(key, list);
    }
  }

  return lines;
}

function renderFlagGroups(
  flags: Readonly<ClercFlagsDefinition>,
  groups: readonly GroupDefinition[],
  theme: Theme,
  columns: number,
): string[] {
  const entries = Object.entries(flags)
    .map(([name, def]) => [name, normalizeFlagValue(def)] as const)
    .filter(([, norm]) => !norm.hidden);

  return renderGroupedSection(
    entries,
    ([, norm]) => norm.group,
    (list) => {
      const hasShort = list.some(([, norm]) => Boolean(norm.short));

      return list.map(([name, norm]) => {
        const left = buildFlagSignature(name, norm, theme, hasShort);
        const meta = buildFlagMeta(norm, theme);
        const right = [norm.description, meta].filter(Boolean).join("  ");

        return [left, right];
      });
    },
    groups,
    theme,
    columns,
  );
}

const renderCommandList = (
  visibleChildren: readonly CommandNode[],
  groups: readonly GroupDefinition[],
  theme: Theme,
  columns: number,
): string[] =>
  renderGroupedSection(
    visibleChildren,
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
        const left = `${theme.command(node.name)}${aliasTag}`;
        const depTag = node.command?.deprecated
          ? `  ${theme.warn("[deprecated]")}`
          : "";
        const right = `${node.command?.description ?? ""}${depTag}`.trim();

        return [left, right];
      }),
    groups,
    theme,
    columns,
  );

export async function renderHelp(
  model: ReadonlyCliModel,
  options: RenderHelpOptions,
): Promise<string> {
  const { meta, tree, globalFlags } = model;
  const { theme, columns = 80 } = options;
  const node = options.node ?? tree.root;
  const command = node.command;
  const isRoot = node.fullPath.length === 0;
  const visibleChildren = tree.listVisibleChildren(node);
  const hasVisibleChildren = visibleChildren.length > 0;

  const sections: string[] = [];

  // 1. Header
  const versionText = formatVersion(meta.version);
  const titleLeft = isRoot
    ? theme.brand(meta.scriptName)
    : `${theme.muted(meta.scriptName)} ${theme.brand(node.fullPath.join(" "))}`;
  const titleWithVersion = versionText
    ? `${titleLeft} ${theme.muted(versionText)}`
    : titleLeft;
  const description = isRoot
    ? (command?.description ?? meta.description)
    : command?.description;
  const headerLines = [
    description
      ? `${titleWithVersion} ${theme.muted("—")} ${description}`
      : titleWithVersion,
  ];
  if (command?.aliases) {
    const aliases = toArray(command.aliases).filter((a) => a.length > 0);
    if (aliases.length > 0) {
      headerLines.push(
        `${theme.muted(aliases.length > 1 ? "Aliases:" : "Alias:")} ${aliases.map((a) => theme.command(a)).join(", ")}`,
      );
    }
  }
  sections.push(headerLines.join("\n"));

  // 2. Usage
  let usage = `  ${meta.scriptName}`;
  if (!isRoot) {
    usage += ` ${node.fullPath.join(" ")}`;
  }
  if (hasVisibleChildren) {
    usage += command
      ? ` ${theme.muted("[command]")}`
      : ` ${theme.muted("<command>")}`;
  }
  const hasCommandFlags =
    command?.flags !== undefined && Object.keys(command.flags).length > 0;
  const hasGlobalFlags = Object.keys(globalFlags).length > 0;
  if (hasCommandFlags || hasGlobalFlags) {
    usage += ` ${theme.muted("[options]")}`;
  }
  if (command?.parameters && command.parameters.length > 0) {
    const ddIdx = command.parameters.indexOf(DOUBLE_DASH);
    const hasRequiredAfterDd =
      ddIdx !== -1 &&
      command.parameters
        .slice(ddIdx + 1)
        .some((p: ParameterDefinitionValue) => {
          const key = typeof p === "string" ? p : p.key;

          return key.startsWith("<");
        });
    const paramTokens = command.parameters.map(
      (p: ParameterDefinitionValue) => {
        if (p === DOUBLE_DASH) {
          return hasRequiredAfterDd ? DOUBLE_DASH : `[${DOUBLE_DASH}]`;
        }

        return typeof p === "string" ? p : p.key;
      },
    );
    usage += ` ${paramTokens.join(" ")}`;
  }
  sections.push(`${theme.heading("Usage:")}\n${usage}`);

  // 3. Arguments (Parameters)
  if (command?.parameters && command.parameters.length > 0) {
    const argRows: [string, string][] = [];
    for (const p of command.parameters) {
      if (p === DOUBLE_DASH) {
        continue;
      }
      const norm = normalizeParameterValue(p);
      const typeLabel =
        norm.placeholder ??
        (norm.type ? formatSingleTypeName(norm.type) : undefined);
      const left = typeLabel
        ? `${theme.command(norm.key)} ${theme.placeholder(`<${typeLabel}>`)}`
        : theme.command(norm.key);
      argRows.push([left, norm.description ?? ""]);
    }
    if (argRows.length > 0) {
      const argLines = formatTwoColumn(argRows, {
        indent: 2,
        maxWidth: columns,
      });
      sections.push(`${theme.heading("Arguments:")}\n${argLines.join("\n")}`);
    }
  }

  const commandGroups = [
    ...model.groups.commands,
    ...(options.groups?.commands ?? []),
  ];
  const flagGroups = [...model.groups.flags, ...(options.groups?.flags ?? [])];
  const globalFlagGroups = [
    ...model.groups.globalFlags,
    ...(options.groups?.globalFlags ?? []),
  ];

  // 4. Commands / Subcommands
  if (hasVisibleChildren) {
    const cmdLines = renderCommandList(
      visibleChildren,
      commandGroups,
      theme,
      columns,
    );
    if (cmdLines.length > 0) {
      const heading = isRoot ? "Commands:" : "Subcommands:";
      sections.push(`${theme.heading(heading)}\n${cmdLines.join("\n")}`);
    }
  }

  // 5. Command Options
  if (hasCommandFlags) {
    const flagLines = renderFlagGroups(
      command.flags,
      flagGroups,
      theme,
      columns,
    );
    if (flagLines.length > 0) {
      sections.push(`${theme.heading("Options:")}\n${flagLines.join("\n")}`);
    }
  }

  // 6. Global Options
  if (hasGlobalFlags) {
    const globalLines = renderFlagGroups(
      globalFlags,
      globalFlagGroups,
      theme,
      columns,
    );
    if (globalLines.length > 0) {
      const heading = hasCommandFlags ? "Global Options:" : "Options:";
      sections.push(`${theme.heading(heading)}\n${globalLines.join("\n")}`);
    }
  }

  // 7. Examples
  const examplesSource =
    command?.examples ?? (isRoot ? options.examples : undefined);
  if (examplesSource) {
    const examples =
      await resolveAsyncValue<readonly (readonly [string, string])[]>(
        examplesSource,
      );
    if (examples.length > 0) {
      const exampleRows = examples.map(
        ([cmd, desc]) => [theme.accent(cmd), theme.muted(desc)] as const,
      );
      const exLines = formatTwoColumn(exampleRows, {
        indent: 2,
        gap: 4,
        maxWidth: columns,
      });
      sections.push(`${theme.heading("Examples:")}\n${exLines.join("\n")}`);
    }
  }

  // 8. Notes
  const notesSource = command?.notes ?? (isRoot ? options.notes : undefined);
  if (notesSource) {
    const notes = await resolveAsyncValue<readonly string[]>(notesSource);
    if (notes.length > 0) {
      const noteLines = notes.map((n) => `  ${n}`);
      sections.push(`${theme.heading("Notes:")}\n${noteLines.join("\n")}`);
    }
  }

  return sections.join("\n\n");
}

export function helpPlugin<const Flag extends boolean = true>(
  options?: HelpPluginOptions<Flag>,
) {
  const {
    command = true,
    flag = true,
    showHelpWhenNoCommandSpecified = true,
    header,
    footer,
    examples,
    notes,
    groups,
  } = options ?? {};
  const globalFlags = (
    flag ? HELP_GLOBAL_FLAGS : undefined
  ) as Flag extends true ? typeof HELP_GLOBAL_FLAGS : {};

  async function renderWithWrappers(
    model: ReadonlyCliModel,
    theme: Theme,
    columns: number,
    node?: CommandNode,
  ): Promise<string> {
    const parts: string[] = [];
    if (header) {
      const h = await resolveAsyncValue(header);
      if (h) {
        parts.push(h);
      }
    }
    parts.push(
      await renderHelp(model, {
        node,
        theme,
        columns,
        groups,
        examples,
        notes,
      }),
    );
    if (footer) {
      const f = await resolveAsyncValue(footer);
      if (f) {
        parts.push(f);
      }
    }

    return parts.join("\n\n");
  }

  return definePlugin({
    name: "clerc:help",
    globalFlags,
    commands: command
      ? (meta) => [
          {
            name: "help",
            description: "Show help for a command",
            parameters: ["[command...]"] as const,
            examples: [
              [`$ ${meta.scriptName} help`, "Show general help"],
              [
                `$ ${meta.scriptName} help <command>`,
                "Show help for a command",
              ],
            ],
            run: async (ctx) => {
              const path = (ctx.parameters as { command: string[] }).command;
              let targetNode = ctx.model.tree.root;
              if (path.length > 0) {
                const found = ctx.model.tree.findNode(path);
                if (!found) {
                  throw new UnknownCommandError(path.join(" "), []);
                }
                targetNode = found;
              }
              const output = await renderWithWrappers(
                ctx.model,
                ctx.theme,
                ctx.terminal.columns,
                targetNode,
              );
              ctx.terminal.stdout(output);
            },
          },
        ]
      : undefined,
    extendContext: (ctx) => {
      async function render(commandPath?: readonly string[]): Promise<string> {
        const targetNode = commandPath
          ? ctx.model.tree.findNode(commandPath)
          : ctx.model.tree.root;

        return renderWithWrappers(
          ctx.model,
          ctx.theme,
          ctx.terminal.columns,
          targetNode,
        );
      }

      return {
        help: {
          render,
          print: async (commandPath?: readonly string[]) => {
            ctx.terminal.stdout(await render(commandPath));
          },
        },
      };
    },
    hooks: {
      onIntercept: async (ctx) => {
        const hasPositionals = (ctx.rawParsed?.parameters.length ?? 0) > 0;
        const explicitHelp =
          flag &&
          Boolean(ctx.flags.help) &&
          (!!ctx.command ||
            ctx.node !== ctx.model.tree.root ||
            !hasPositionals);
        const implicitHelp =
          showHelpWhenNoCommandSpecified && !ctx.command && !hasPositionals;

        if (explicitHelp || implicitHelp) {
          const output = await renderWithWrappers(
            ctx.model,
            ctx.theme,
            ctx.terminal.columns,
            ctx.node,
          );
          ctx.terminal.stdout(output);

          return { handled: true, exitCode: 0 };
        }
      },
    },
  });
}
