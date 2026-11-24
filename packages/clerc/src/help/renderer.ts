import type { Theme } from "@clerc/theme";

import type { CommandNode } from "../command-tree";
import type { CliModel, MetaAsyncGetter } from "../types";
import { resolveAsyncValue } from "../utils";
import type {
  HelpArgumentItem,
  HelpCommandItem,
  HelpDocument,
  HelpExampleItem,
  HelpOptionGroup,
  HelpOptionItem,
} from "./document";
import { buildHelpDocument } from "./document";
import type { TwoColumnRow } from "./layout";
import {
  MAX_READABLE_WIDTH,
  formatTwoColumn,
  measureColumnWidth,
  wrapLine,
} from "./layout";

export interface HelpRenderContext {
  readonly theme: Theme;
  readonly columns: number;
  readonly unicode: boolean;
  readonly hasAnyShort: boolean;
  readonly formatCommands: (rows: readonly TwoColumnRow[]) => string[];
  readonly formatOptions: (rows: readonly TwoColumnRow[]) => string[];
  readonly section: (
    heading: string,
    lines: readonly string[],
  ) => string | undefined;
}

export interface HelpSectionRenderers {
  readonly header: (
    doc: HelpDocument,
    ctx: HelpRenderContext,
  ) => string | undefined;
  readonly usage: (
    doc: HelpDocument,
    ctx: HelpRenderContext,
  ) => string | undefined;
  readonly arguments: (
    doc: HelpDocument,
    ctx: HelpRenderContext,
  ) => string | undefined;
  readonly commands: (
    doc: HelpDocument,
    ctx: HelpRenderContext,
  ) => string | undefined;
  readonly options: (
    doc: HelpDocument,
    ctx: HelpRenderContext,
  ) => string | undefined;
  readonly globalOptions: (
    doc: HelpDocument,
    ctx: HelpRenderContext,
  ) => string | undefined;
  readonly constraints: (
    doc: HelpDocument,
    ctx: HelpRenderContext,
  ) => string | undefined;
  readonly examples: (
    doc: HelpDocument,
    ctx: HelpRenderContext,
  ) => string | undefined;
  readonly notes: (
    doc: HelpDocument,
    ctx: HelpRenderContext,
  ) => string | undefined;
}

export interface RenderHelpDocumentOptions {
  readonly theme: Theme;
  readonly columns?: number;
  readonly unicode?: boolean;
  readonly header?: string;
  readonly footer?: string;
  readonly sections?: Partial<HelpSectionRenderers>;
}

export interface RenderHelpOptions {
  readonly node?: CommandNode;
  readonly theme: Theme;
  readonly columns?: number;
  readonly unicode?: boolean;
  readonly header?: MetaAsyncGetter<string | undefined | void>;
  readonly footer?: MetaAsyncGetter<string | undefined | void>;
  readonly sections?: Partial<HelpSectionRenderers>;
}

const MAX_RULE_WIDTH = 72;
const SNAP_MAX_COL_WIDTH = 24;
const SNAP_MAX_DIFF = 10;

function formatDeprecatedTag(
  deprecated: boolean | string | undefined,
  theme: Theme,
): string | undefined {
  if (!deprecated) {
    return undefined;
  }

  return theme.warn(
    typeof deprecated === "string"
      ? `[deprecated: ${deprecated}]`
      : "[deprecated]",
  );
}

function formatArgumentRow(arg: HelpArgumentItem, theme: Theme): TwoColumnRow {
  const tags: string[] = [];
  if (arg.typeLabel) {
    tags.push(theme.placeholder(`[${arg.typeLabel}]`));
  }
  if (arg.defaultText !== undefined) {
    tags.push(theme.muted(`[default: ${arg.defaultText}]`));
  }
  if (arg.env) {
    tags.push(theme.muted(`[env: ${arg.env}]`));
  }

  return [theme.command(arg.token), { text: arg.description, tags }];
}

function formatCommandRow(cmd: HelpCommandItem, theme: Theme): TwoColumnRow {
  const aliasPart =
    cmd.aliases.length > 0
      ? ` ${theme.muted(`(${cmd.aliases.join(", ")})`)}`
      : "";
  const tags: string[] = [];
  if (cmd.isDefault) {
    tags.push(theme.muted("[default]"));
  }
  const depTag = formatDeprecatedTag(cmd.deprecated, theme);
  if (depTag) {
    tags.push(depTag);
  }

  return [
    `${theme.command(cmd.name)}${aliasPart}`,
    { text: cmd.description, tags },
  ];
}

function formatOptionRow(
  opt: HelpOptionItem,
  theme: Theme,
  hasAnyShort: boolean,
): TwoColumnRow {
  const base = opt.short
    ? `${theme.flag(`-${opt.short}`)}${theme.muted(", ")}${theme.flag(opt.longName)}`
    : `${hasAnyShort ? "    " : ""}${theme.flag(opt.longName)}`;
  const aliasPart = opt.aliases
    .map((alias) => `${theme.muted(", ")}${theme.flag(alias)}`)
    .join("");
  const negatedPart = opt.negatedName
    ? `${theme.muted(", ")}${theme.flag(opt.negatedName)}`
    : "";
  const placeholderPart = opt.placeholder
    ? opt.optionalValue
      ? theme.placeholder(`[=${opt.placeholder}]`)
      : ` ${theme.placeholder(opt.placeholder)}`
    : "";
  const left = `${base}${aliasPart}${negatedPart}${placeholderPart}`;

  const tags: string[] = [];
  if (opt.required) {
    tags.push(theme.muted("[required]"));
  }
  if (opt.defaultText !== undefined) {
    tags.push(theme.muted(`[default: ${opt.defaultText}]`));
  }
  if (opt.env) {
    tags.push(theme.muted(`[env: ${opt.env}]`));
  }
  const depTag = formatDeprecatedTag(opt.deprecated, theme);
  if (depTag) {
    tags.push(depTag);
  }

  return [left, { text: opt.description, tags }];
}

function renderOptionGroups(
  groups: readonly HelpOptionGroup[],
  ctx: HelpRenderContext,
): string | undefined {
  const rendered = groups
    .map((group) =>
      ctx.section(
        group.title,
        ctx.formatOptions(
          group.items.map((opt) =>
            formatOptionRow(opt, ctx.theme, ctx.hasAnyShort),
          ),
        ),
      ),
    )
    .filter((block): block is string => Boolean(block));

  return rendered.length > 0 ? rendered.join("\n\n") : undefined;
}

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

function renderExampleLines(
  examples: readonly HelpExampleItem[],
  theme: Theme,
): string[] {
  const lines: string[] = [];
  for (const [i, example] of examples.entries()) {
    if (i > 0) {
      lines.push("");
    }
    if (example.description) {
      lines.push(`  ${theme.muted(`# ${example.description}`)}`);
    }
    lines.push(`  ${highlightExampleCommand(example.command, theme)}`);
  }

  return lines;
}

export const defaultHelpSections: HelpSectionRenderers = {
  header(doc, { theme, columns }) {
    const { name, commandPath, version, description, aliases } = doc.header;
    const titleLeft =
      commandPath.length === 0
        ? theme.brand(name)
        : `${theme.muted(name)} ${theme.brand(commandPath.join(" "))}`;
    const titleParts = [
      titleLeft,
      version ? theme.muted(version) : undefined,
    ].filter(Boolean);
    const aliasPart =
      aliases.length > 0
        ? theme.muted(
            `${aliases.length > 1 ? "aliases" : "alias"}: ${aliases.join(", ")}`,
          )
        : undefined;
    const firstLine = aliasPart
      ? `${titleParts.join(" ")}  ${aliasPart}`
      : titleParts.join(" ");

    if (!description) {
      return firstLine;
    }

    const wrapWidth = Math.min(columns, MAX_READABLE_WIDTH);
    const descLines = description
      .split("\n")
      .flatMap((paragraph) => wrapLine(paragraph, wrapWidth));

    return [firstLine, ...descLines].join("\n");
  },

  usage(doc, { theme }) {
    const { command, subcommand, hasOptions, args } = doc.usage;
    const parts = [
      theme.command(command),
      subcommand === "required"
        ? theme.placeholder("<command>")
        : subcommand === "optional"
          ? theme.muted("[command]")
          : "",
      hasOptions ? theme.muted("[options]") : "",
      ...args.map((arg) =>
        arg.kind === "double-dash" || arg.optional
          ? theme.muted(arg.text)
          : theme.placeholder(arg.text),
      ),
    ].filter(Boolean);

    return `${theme.heading("USAGE")}   ${parts.join(" ")}`;
  },

  arguments(doc, ctx) {
    if (doc.arguments.length === 0) {
      return undefined;
    }

    return ctx.section(
      "Arguments",
      ctx.formatOptions(
        doc.arguments.map((arg) => formatArgumentRow(arg, ctx.theme)),
      ),
    );
  },

  commands(doc, ctx) {
    const rendered = doc.commandGroups
      .map((group) =>
        ctx.section(
          group.title,
          ctx.formatCommands(
            group.items.map((cmd) => formatCommandRow(cmd, ctx.theme)),
          ),
        ),
      )
      .filter((block): block is string => Boolean(block));

    return rendered.length > 0 ? rendered.join("\n\n") : undefined;
  },

  options(doc, ctx) {
    return renderOptionGroups(doc.optionGroups, ctx);
  },

  globalOptions(doc, ctx) {
    return renderOptionGroups(doc.globalOptionGroups, ctx);
  },

  constraints(doc, ctx) {
    if (doc.constraints.length === 0) {
      return undefined;
    }

    return ctx.section(
      "Constraints",
      ctx.formatOptions(
        doc.constraints.map((item) => [
          ctx.theme.muted(item.label),
          { text: item.text },
        ]),
      ),
    );
  },

  examples(doc, ctx) {
    if (doc.examples.length === 0) {
      return undefined;
    }

    return ctx.section("Examples", renderExampleLines(doc.examples, ctx.theme));
  },

  notes(doc, ctx) {
    if (doc.notes.length === 0) {
      return undefined;
    }

    const noteWidth = Math.max(
      20,
      Math.min(ctx.columns, MAX_READABLE_WIDTH) - 2,
    );
    const lines = doc.notes.flatMap((note) =>
      wrapLine(note, noteWidth).map((line) => `  ${ctx.theme.muted(line)}`),
    );

    return ctx.section("Notes", lines);
  },
};

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

export function renderHelpDocument(
  doc: HelpDocument,
  options: RenderHelpDocumentOptions,
): string {
  const { theme, columns = 80, unicode = true } = options;
  const sections: HelpSectionRenderers = {
    ...defaultHelpSections,
    ...options.sections,
  };

  const allOptions = [
    ...doc.optionGroups.flatMap((g) => g.items),
    ...doc.globalOptionGroups.flatMap((g) => g.items),
  ];
  const hasAnyShort = allOptions.some((opt) => Boolean(opt.short));

  const commandRows = doc.commandGroups.flatMap((g) =>
    g.items.map((cmd) => formatCommandRow(cmd, theme)),
  );
  const optionRows = [
    ...doc.arguments.map((arg) => formatArgumentRow(arg, theme)),
    ...allOptions.map((opt) => formatOptionRow(opt, theme, hasAnyShort)),
  ];

  const { commandColWidth, optionColWidth } = resolveAlignedWidths(
    commandRows,
    optionRows,
    columns,
  );
  const gap = columns >= 90 ? 4 : 3;

  const ctx: HelpRenderContext = {
    theme,
    columns,
    unicode,
    hasAnyShort,
    formatCommands: (rows) =>
      formatTwoColumn(rows, {
        indent: 2,
        gap,
        maxWidth: columns,
        colWidth: commandColWidth,
      }),
    formatOptions: (rows) =>
      formatTwoColumn(rows, {
        indent: 2,
        gap,
        maxWidth: columns,
        colWidth: optionColWidth,
      }),
    section: (heading, lines) =>
      lines.length > 0
        ? `${theme.heading(heading.toUpperCase())}\n${lines.join("\n")}`
        : undefined,
  };

  const ruleChar = unicode ? "─" : "-";
  const topRule = theme.muted(
    ruleChar.repeat(Math.min(columns, MAX_RULE_WIDTH)),
  );
  const headerText = sections.header(doc, ctx);
  const usageText = sections.usage(doc, ctx);
  const masthead = [
    headerText,
    headerText && usageText ? topRule : undefined,
    usageText,
  ]
    .filter(Boolean)
    .join("\n");

  const blocks = [
    options.header,
    masthead || undefined,
    sections.arguments(doc, ctx),
    sections.commands(doc, ctx),
    sections.options(doc, ctx),
    sections.globalOptions(doc, ctx),
    sections.constraints(doc, ctx),
    sections.examples(doc, ctx),
    sections.notes(doc, ctx),
    options.footer,
  ];

  return blocks.filter(Boolean).join("\n\n");
}

export async function renderHelp(
  model: CliModel,
  options: RenderHelpOptions,
): Promise<string> {
  const doc = await buildHelpDocument(model, options.node);
  const header = options.header
    ? await resolveAsyncValue(options.header, model.meta)
    : undefined;
  const footer = options.footer
    ? await resolveAsyncValue(options.footer, model.meta)
    : undefined;

  return renderHelpDocument(doc, {
    theme: options.theme,
    columns: options.columns,
    unicode: options.unicode,
    header: header ?? undefined,
    footer: footer ?? undefined,
    sections: options.sections,
  });
}
