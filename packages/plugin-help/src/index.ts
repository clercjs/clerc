
// TODO: unit tests

import type { Clerc, Command, HandlerContext, SingleCommandType } from "@clerc/core";
import { NoSuchCommandError, SingleCommand, definePlugin, resolveCommand } from "@clerc/core";

import { gracefulFlagName, toArray } from "@clerc/utils";
import pc from "picocolors";

import type { Section } from "./renderer";
import { render } from "./renderer";
import { splitTable, stringifyType } from "./utils";

const DELIMITER = pc.yellow("-");
const print = (s: string) => { process.stdout.write(s); };

const formatCommandName = (name: string | string[] | SingleCommandType) => Array.isArray(name)
  ? name.join(" ")
  : typeof name === "string"
    ? name
    : "<Single Command>";

const generateCliDetail = (sections: Section[], cli: Clerc, subcommand?: Command<string | SingleCommandType>) => {
  const items = [
    {
      title: "Name:",
      body: pc.red(cli._name),
    },
    {
      title: "Version:",
      body: pc.yellow(cli._version),
    },
  ];
  if (subcommand) {
    items.push({
      title: "Subcommand:",
      body: pc.green(`${cli._name} ${formatCommandName(subcommand.name)}`),
    });
  }
  sections.push({
    type: "inline",
    items,
  });
  sections.push({
    title: "Description:",
    body: [subcommand?.description || cli._description],
  });
};

const generateExamples = (sections: Section[], examples: [string, string][]) => {
  const examplesFormatted = examples.map(([command, description]) => [command, DELIMITER, description]);
  sections.push({
    title: "Examples:",
    body: splitTable(...examplesFormatted),
  });
};

const generateHelp = (ctx: HandlerContext, notes: string[] | undefined, examples: [string, string][] | undefined) => {
  const { cli } = ctx;
  const sections = [] as Section[];
  generateCliDetail(sections, cli);
  sections.push({
    title: "Usage:",
    body: [pc.magenta(`$ ${cli._name} [command] [flags]`)],
  });
  const commands = [...(ctx.hasSingleCommand ? [cli._commands[SingleCommand]!] : []), ...Object.values(cli._commands)].map((command) => {
    const commandNameWithAlias = [typeof command.name === "symbol" ? "" : command.name, ...toArray(command.alias || [])]
      .sort((a, b) => {
        if (a === SingleCommand) { return -1; }
        if (b === SingleCommand) { return 1; }
        return a.length - b.length;
      })
      .map((n) => {
        return (n === "" || typeof n === "symbol") ? `${cli._name}` : `${cli._name} ${n}`;
      })
      .join(", ");
    return [pc.cyan(commandNameWithAlias), DELIMITER, command.description];
  });
  sections.push({
    title: "Commands:",
    body: splitTable(...commands),
  });
  if (notes) {
    sections.push({
      title: "Notes:",
      body: notes,
    });
  }
  if (examples) {
    generateExamples(sections, examples);
  }
  return render(sections);
};

const generateSubcommandHelp = (ctx: HandlerContext, command: string[] | SingleCommandType) => {
  const { cli } = ctx;
  const subcommand = resolveCommand(cli._commands, command);
  if (!subcommand) {
    throw new NoSuchCommandError(formatCommandName(command));
  }
  const sections = [] as Section[];
  generateCliDetail(sections, cli, subcommand);
  const parameters = subcommand.parameters?.join(" ") || undefined;
  sections.push({
    title: "Usage:",
    body: [pc.magenta(`$ ${cli._name}${ctx.name === SingleCommand ? "" : ` ${formatCommandName(subcommand.name)}`}${parameters ? ` ${parameters}` : ""}${subcommand.flags ? " [flags]" : ""}`)],
  });
  if (subcommand.flags) {
    sections.push({
      title: "Flags:",
      body: splitTable(
        ...Object.entries(subcommand.flags).map(([name, flag]) => {
          const flagNameWithAlias = [gracefulFlagName(name)];
          if (flag.alias) {
            flagNameWithAlias.push(gracefulFlagName(flag.alias));
          }
          const items = [pc.blue(flagNameWithAlias.join(", "))];
          if (flag.description) {
            items.push(DELIMITER, flag.description);
          }
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
      title: "Notes:",
      body: subcommand.notes,
    });
  }
  if (subcommand.examples) {
    generateExamples(sections, subcommand.examples);
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
}
export const helpPlugin = ({
  command = true,
  showHelpWhenNoCommand = true,
  notes,
  examples,
}: HelpPluginOptions = {}) => definePlugin({
  setup: (cli) => {
    if (command) {
      cli = cli.command("help", "Show help", {
        parameters: [
          "[command...]",
        ],
        notes: [
          "If no command is specified, show help for the CLI.",
          "If a command is specified, show help for the command.",
          "-h is an alias for --help.",
        ],
        examples: [
          [`$ ${cli._name} help`, "Show help"],
          [`$ ${cli._name} help <command>`, "Show help for a specific command"],
          [`$ ${cli._name} <command> --help`, "Show help for a specific command"],
        ],
      })
        .on("help", (ctx) => {
          if (ctx.parameters.command.length) {
            print(generateSubcommandHelp(ctx, ctx.parameters.command));
          } else {
            print(generateHelp(ctx, notes, examples));
          }
        });
    }

    cli.inspector((ctx, next) => {
      const hasHelpFlag = ctx.raw.mergedFlags.h || ctx.raw.mergedFlags.help;
      if (!ctx.hasSingleCommandOrAlias && !ctx.raw._.length && showHelpWhenNoCommand && !hasHelpFlag) {
        let str = "No command supplied.\n\n";
        str += generateHelp(ctx, notes, examples);
        str += "\n";
        print(str);
        process.exit(1);
      } else if (hasHelpFlag) {
        if (ctx.raw._.length) {
          if (ctx.called !== SingleCommand) {
            if (ctx.name === SingleCommand) {
              print(generateHelp(ctx, notes, examples));
            } else {
              print(generateSubcommandHelp(ctx, ctx.raw._));
            }
          }
        } else {
          print(generateHelp(ctx, notes, examples));
        }
      } else {
        next();
      }
    });

    return cli;
  },
});
