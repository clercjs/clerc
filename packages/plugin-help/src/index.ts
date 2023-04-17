import type { HandlerContext, RootType } from "@clerc/core";
import { NoSuchCommandError, Root, definePlugin, formatCommandName, withBrackets } from "@clerc/core";
import { resolveCommandStrict, toArray } from "@clerc/utils";
import * as yc from "yoctocolors";

import { locales } from "./locales";
import type { Render, Renderers, Section } from "./renderer";
import { defaultRenderers, render } from "./renderer";
import { DELIMITER, formatFlags, generateCliDetail, generateExamples, print, sortName, splitTable } from "./utils";

declare module "@clerc/core" {
  export interface CommandCustomProperties {
    help?: {
      renderers?: Renderers;
      examples?: [string, string][];
      notes?: string[];
    };
  }
}

const generateHelp = (
  render: Render,
  ctx: HandlerContext,
  notes: string[] | undefined,
  examples: [string, string][] | undefined,
  _renderers?: Renderers,
) => {
  const { cli } = ctx;
  const { t } = cli.i18n;
  let sections = [] as Section[];
  const renderers = Object.assign({}, defaultRenderers, _renderers);
  generateCliDetail(sections, cli);
  sections.push({
    title: t("help.usage")!,
    body: [yc.magenta(`$ ${cli._name} ${withBrackets("command", ctx.hasRootOrAlias)} [flags]`)],
  });
  const commands = [
    ...(ctx.hasRoot ? [cli._commands[Root]!] : []),
    ...Object.values(cli._commands),
  ].map((command) => {
    const commandNameWithAlias = [typeof command.name === "symbol" ? "" : command.name, ...toArray(command.alias ?? [])]
      .sort(sortName)
      .map((n) => {
        return (n === "" || typeof n === "symbol") ? `${cli._name}` : `${cli._name} ${n}`;
      })
      .join(", ");
    return [yc.cyan(commandNameWithAlias), DELIMITER, command.description];
  });
  if (commands.length) {
    sections.push({
      title: t("help.commands")!,
      body: splitTable(commands),
    });
  }
  const globalFlags = formatFlags(cli._flags, t, renderers);
  if (globalFlags.length) {
    sections.push({
      title: t("help.globalFlags")!,
      body: splitTable(globalFlags),
    });
  }
  if (notes) {
    sections.push({
      title: t("help.notes")!,
      body: notes,
    });
  }
  if (examples) {
    generateExamples(sections, examples, t);
  }
  sections = renderers.renderSections(sections);
  return render(sections);
};

const generateSubcommandHelp = (render: Render, ctx: HandlerContext, command: string[] | RootType) => {
  const { cli } = ctx;
  const { t } = cli.i18n;
  const [subcommand] = resolveCommandStrict(cli._commands, command, t);
  if (!subcommand) {
    throw new NoSuchCommandError(formatCommandName(command), t);
  }
  const renderers = Object.assign({}, defaultRenderers, subcommand.help?.renderers);
  let sections = [] as Section[];
  if (command === Root) {
    generateCliDetail(sections, cli);
  } else {
    generateCliDetail(sections, cli, {
      ...subcommand,
      name: formatCommandName(command),
    });
  }
  const parameters = subcommand.parameters?.join(" ") ?? undefined;
  const commandName = command === Root ? "" : ` ${formatCommandName(command)}`;
  const parametersString = parameters ? ` ${parameters}` : "";
  const flagsString = subcommand.flags ? " [flags]" : "";
  sections.push({
    title: t("help.usage")!,
    body: [yc.magenta(`$ ${cli._name}${commandName}${parametersString}${flagsString}`)],
  });
  const globalFlags = formatFlags(cli._flags, t, renderers);
  if (globalFlags.length) {
    sections.push({
      title: t("help.globalFlags")!,
      body: splitTable(globalFlags),
    });
  }
  if (subcommand.flags) {
    sections.push({
      title: t("help.flags")!,
      body: splitTable(formatFlags(subcommand.flags, t, renderers)),
    });
  }
  if (subcommand?.help?.notes) {
    sections.push({
      title: t("help.notes")!,
      body: subcommand.help.notes,
    });
  }
  if (subcommand?.help?.examples) {
    generateExamples(sections, subcommand?.help?.examples, t);
  }
  sections = renderers.renderSections(sections);
  return render(sections);
};

export interface HelpPluginOptions {
  /**
   * Whether to register the help command.
   *
   * @default true
   */
  command?: boolean;
  /**
   * Whether to register the global help flag.
   *
   * @default true
   */
  flag?: boolean;
  /**
   * Whether to show help when no command is specified.
   *
   * @default true
   */
  showHelpWhenNoCommand?: boolean;
  /**
   * Global notes.
   */
  notes?: string[];
  /**
   * Global examples.
   */
  examples?: [string, string][];
  /**
   * Banner.
   */
  banner?: string;
  /**
   * Renderers.
   */
  renderers?: Renderers;
}
export const helpPlugin = ({
  command = true,
  flag = true,
  showHelpWhenNoCommand = true,
  notes,
  examples,
  banner,
  renderers,
}: HelpPluginOptions = {}) =>
  definePlugin({
    setup: (cli) => {
      const { add, t } = cli.i18n;
      add(locales);
      const printHelp = (s: string) => {
        banner && print(`${banner}\n`);
        print(s);
      };

      if (command) {
        cli = cli.command("help", t("help.commandDescription")!, {
          parameters: [
            "[command...]",
          ],
          help: {
            notes: [
              t("help.notes.1")!,
              t("help.notes.2")!,
              t("help.notes.3")!,
            ],
            examples: [
              [`$ ${cli._name} help`, t("help.examples.1")!],
              [`$ ${cli._name} help <command>`, t("help.examples.2")!],
              [`$ ${cli._name} <command> --help`, t("help.examples.2")!],
            ],
          },
        })
          .on("help", (ctx) => {
            if (ctx.parameters.command.length) {
              printHelp(generateSubcommandHelp(render, ctx, ctx.parameters.command));
            } else {
              printHelp(generateHelp(render, ctx, notes, examples, renderers));
            }
          });
      }

      if (flag) {
        cli = cli.flag("help", t("help.commandDescription")!, {
          alias: "h",
          type: Boolean,
          default: false,
        });
      }

      cli.inspector((ctx, next) => {
        const shouldShowHelp = ctx.flags.help;
        if (!ctx.hasRootOrAlias && !ctx.raw._.length && showHelpWhenNoCommand && !shouldShowHelp) {
          let str = `${t("core.noCommandGiven")!}\n\n`;
          str += generateHelp(render, ctx, notes, examples, renderers);
          str += "\n";
          printHelp(str);
          process.exit(1);
        } else if (shouldShowHelp) {
          if (ctx.raw._.length) {
            if (ctx.called !== Root) {
              if (ctx.name === Root) {
                printHelp(generateHelp(render, ctx, notes, examples, renderers));
              } else {
                printHelp(generateSubcommandHelp(render, ctx, ctx.raw._));
              }
            } else {
              printHelp(generateSubcommandHelp(render, ctx, ctx.raw._));
            }
          } else {
            if (ctx.hasRootOrAlias) {
              printHelp(generateSubcommandHelp(render, ctx, Root));
            } else {
              printHelp(generateHelp(render, ctx, notes, examples, renderers));
            }
          }
        } else {
          next();
        }
      });

      return cli;
    },
  });
