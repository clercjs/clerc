
// TODO: unit tests

import type { Clerc, Command, Flags, HandlerContext, RootType, TranslateFn } from "@clerc/core";
import { NoSuchCommandError, Root, definePlugin, formatCommandName, resolveCommandStrict, withBrackets } from "@clerc/core";

import { gracefulFlagName, toArray } from "@clerc/utils";
import pc from "picocolors";

import type { Render, Section } from "./renderer";
import { renderCliffy } from "./renderer";
import { sortName, splitTable, stringifyType } from "./utils";
import { locales } from "./locales";

const DELIMITER = pc.yellow("-");

const print = (s: string) => { process.stdout.write(s); };

const generateCliDetail = (sections: Section[], cli: Clerc, subcommand?: Command<string | RootType>) => {
  const { t } = cli.i18n;
  const items = [
    {
      title: t("help.name")!,
      body: pc.red(cli._name),
    },
    {
      title: t("help.version")!,
      body: pc.yellow(cli._version),
    },
  ];
  if (subcommand) {
    items.push({
      title: t("help.subcommand")!,
      body: pc.green(`${cli._name} ${formatCommandName(subcommand.name)}`),
    });
  }
  sections.push({
    type: "inline",
    items,
  });
  sections.push({
    title: t("help.description")!,
    body: [subcommand?.description || cli._description],
  });
};

const generateExamples = (sections: Section[], examples: [string, string][], t: TranslateFn) => {
  const examplesFormatted = examples.map(([command, description]) => [command, DELIMITER, description]);
  sections.push({
    title: t("help.examples")!,
    body: splitTable(...examplesFormatted),
  });
};

const generateHelp = (render: Render, ctx: HandlerContext, notes: string[] | undefined, examples: [string, string][] | undefined) => {
  const { cli } = ctx;
  const { t } = cli.i18n;
  const sections = [] as Section[];
  generateCliDetail(sections, cli);
  sections.push({
    title: t("help.usage")!,
    body: [pc.magenta(`$ ${cli._name} ${withBrackets("command", ctx.hasRootOrAlias)} [flags]`)],
  });
  const commands = [
    ...(ctx.hasRoot ? [cli._commands[Root]!] : []),
    ...Object.values(cli._commands),
  ].map((command) => {
    const commandNameWithAlias = [typeof command.name === "symbol" ? "" : command.name, ...toArray(command.alias || [])]
      .sort(sortName)
      .map((n) => {
        return (n === "" || typeof n === "symbol") ? `${cli._name}` : `${cli._name} ${n}`;
      })
      .join(", ");
    return [pc.cyan(commandNameWithAlias), DELIMITER, command.description];
  });
  if (commands.length) {
    sections.push({
      title: t("help.commands")!,
      body: splitTable(...commands),
    });
  }
  const flags = Object.entries(cli._flags as Flags)
    .map(([name, flag]) => {
      const flagNameWithAlias = [name, ...toArray(flag.alias || [])]
        .map(gracefulFlagName)
        .join(", ");
      return [pc.cyan(flagNameWithAlias), DELIMITER, flag.description];
    });
  if (flags.length) {
    sections.push({
      title: t("help.flags")!,
      body: splitTable(...flags),
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
  return render(sections);
};

const generateSubcommandHelp = (render: Render, ctx: HandlerContext, command: string[] | RootType) => {
  const { cli } = ctx;
  const { t } = cli.i18n;
  const [subcommand] = resolveCommandStrict(cli._commands, command, t);
  if (!subcommand) {
    throw new NoSuchCommandError(formatCommandName(command), t);
  }
  const sections = [] as Section[];
  if (command === Root) {
    generateCliDetail(sections, cli);
  } else {
    generateCliDetail(sections, cli, {
      ...subcommand,
      name: formatCommandName(command),
    });
  }
  const parameters = subcommand.parameters?.join(" ") || undefined;
  const commandName = command === Root ? "" : ` ${formatCommandName(command)}`;
  const parametersString = parameters ? ` ${parameters}` : "";
  const flagsString = subcommand.flags ? " [flags]" : "";
  sections.push({
    title: t("help.usage")!,
    body: [pc.magenta(`$ ${cli._name}${commandName}${parametersString}${flagsString}`)],
  });
  if (subcommand.flags) {
    sections.push({
      title: t("help.flags")!,
      body: splitTable(
        ...Object.entries(subcommand.flags).map(([name, flag]) => {
          const flagNameWithAlias = [gracefulFlagName(name)];
          if (flag.alias) {
            flagNameWithAlias.push(gracefulFlagName(flag.alias));
          }
          const items = [pc.blue(flagNameWithAlias.join(", "))];
          items.push(DELIMITER, flag.description);
          if (flag.type) {
            const type = stringifyType(flag.type);
            items.push(pc.gray(`(${type})`));
          }
          return items;
        }),
      ),
    });
  }
  if (subcommand.notes) {
    sections.push({
      title: t("help.notes")!,
      body: subcommand.notes,
    });
  }
  if (subcommand.examples) {
    generateExamples(sections, subcommand.examples, t);
  }
  return render(sections);
};

export interface HelpPluginOptions {
  /**
   * Whether to registr the help command.
   * @default true
   */
  command?: boolean
  /**
   * Whether to show help when no command is specified.
   * @default true
   */
  showHelpWhenNoCommand?: boolean
  /**
   * Global notes.
   */
  notes?: string[]
  /**
   * Global examples.
   */
  examples?: [string, string][]
  /**
   * Banner
   */
  banner?: string
  /**
   * Render type
   */
  renderer?: "cliffy"
}
export const helpPlugin = ({
  command = true,
  showHelpWhenNoCommand = true,
  notes,
  examples,
  banner,
  renderer = "cliffy",
}: HelpPluginOptions = {}) => definePlugin({
  setup: (cli) => {
    const { add, t } = cli.i18n;
    add(locales);
    const render: Render = renderer === "cliffy" ? renderCliffy : () => "";
    const printHelp = (s: string) => {
      banner && print(`${banner}\n`);
      print(s);
    };

    if (command) {
      cli = cli.command("help", t("help.helpDdescription")!, {
        parameters: [
          "[command...]",
        ],
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
      })
        .on("help", (ctx) => {
          if (ctx.parameters.command.length) {
            printHelp(generateSubcommandHelp(render, ctx, ctx.parameters.command));
          } else {
            printHelp(generateHelp(render, ctx, notes, examples));
          }
        });
    }

    cli = cli.flag("help", t("help.helpDdescription")!, {
      alias: "h",
      type: Boolean,
      default: false,
    });

    cli.inspector((ctx, next) => {
      const shouldShowHelp = ctx.flags.help;
      if (!ctx.hasRootOrAlias && !ctx.raw._.length && showHelpWhenNoCommand && !shouldShowHelp) {
        let str = `${t("core.noCommandGiven")}\n\n`;
        str += generateHelp(render, ctx, notes, examples);
        str += "\n";
        printHelp(str);
        process.exit(1);
      } else if (shouldShowHelp) {
        if (ctx.raw._.length) {
          if (ctx.called !== Root) {
            if (ctx.name === Root) {
              printHelp(generateHelp(render, ctx, notes, examples));
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
            printHelp(generateHelp(render, ctx, notes, examples));
          }
        }
      } else {
        next();
      }
    });

    return cli;
  },
});
