
// TODO: unit tests

import type { Clerc, Command, HandlerContext, RootType } from "@clerc/core";
import { NoSuchCommandError, Root, definePlugin, formatCommandName, resolveCommand, withBrackets } from "@clerc/core";

import { gracefulFlagName, toArray } from "@clerc/utils";
import pc from "picocolors";

import type { Render, Section } from "./renderer";
import { renderCliffy, renderTyper } from "./renderer";
import { splitTable, stringifyType } from "./utils";

const DELIMITER = pc.yellow("-");
const NO_DESCRIPTION = "(No description)";
const NAME = "Name";
const VERSION = "Version";
const SUBCOMMAND = "Subcommand";
const COMMANDS = "Commands";
const FLAGS = "Flags";
const DESCRIPTION = "Description";
const USAGE = "Usage";
const EXAMPLES = "Examples";
const NOTES = "Notes";

const print = (s: string) => { process.stdout.write(s); };

const generateCliDetail = (sections: Section[], cli: Clerc, subcommand?: Command<string | RootType>) => {
  const items = [
    {
      title: NAME,
      body: pc.red(cli._name),
    },
    {
      title: VERSION,
      body: pc.yellow(cli._version),
    },
  ];
  if (subcommand) {
    items.push({
      title: SUBCOMMAND,
      body: pc.green(`${cli._name} ${formatCommandName(subcommand.name)}`),
    });
  }
  sections.push({
    type: "inline",
    items,
  });
  sections.push({
    title: DESCRIPTION,
    body: [subcommand?.description || cli._description],
  });
};

const generateExamples = (sections: Section[], examples: [string, string][]) => {
  const examplesFormatted = examples.map(([command, description]) => [command, DELIMITER, description]);
  sections.push({
    title: EXAMPLES,
    body: splitTable(...examplesFormatted),
  });
};

const generateHelp = (render: Render, ctx: HandlerContext, notes: string[] | undefined, examples: [string, string][] | undefined) => {
  const { cli } = ctx;
  const sections = [] as Section[];
  generateCliDetail(sections, cli);
  sections.push({
    title: USAGE,
    body: [pc.magenta(`$ ${cli._name} ${withBrackets("command", ctx.hasRootOrAlias)} [flags]`)],
  });
  const commands = [...(ctx.hasRoot ? [cli._commands[Root]!] : []), ...Object.values(cli._commands)].map((command) => {
    const commandNameWithAlias = [typeof command.name === "symbol" ? "" : command.name, ...toArray(command.alias || [])]
      .sort((a, b) => {
        if (a === Root) { return -1; }
        if (b === Root) { return 1; }
        return a.length - b.length;
      })
      .map((n) => {
        return (n === "" || typeof n === "symbol") ? `${cli._name}` : `${cli._name} ${n}`;
      })
      .join(", ");
    return [pc.cyan(commandNameWithAlias), DELIMITER, command.description];
  });
  sections.push({
    title: COMMANDS,
    body: splitTable(...commands),
  });
  if (notes) {
    sections.push({
      title: NOTES,
      body: notes,
    });
  }
  if (examples) {
    generateExamples(sections, examples);
  }
  return render(sections);
};

const generateSubcommandHelp = (render: Render, ctx: HandlerContext, command: string[] | RootType) => {
  const { cli } = ctx;
  const subcommand = resolveCommand(cli._commands, command);
  if (!subcommand) {
    throw new NoSuchCommandError(formatCommandName(command));
  }
  const sections = [] as Section[];
  generateCliDetail(sections, cli, subcommand);
  const parameters = subcommand.parameters?.join(" ") || undefined;
  const commandName = ctx.name === Root ? "" : ` ${formatCommandName(subcommand.name)}`;
  const parametersString = parameters ? ` ${parameters}` : "";
  const flagsString = subcommand.flags ? " [flags]" : "";
  sections.push({
    title: USAGE,
    body: [pc.magenta(`$ ${cli._name}${commandName}${parametersString}${flagsString}`)],
  });
  if (subcommand.flags) {
    sections.push({
      title: FLAGS,
      body: splitTable(
        ...Object.entries(subcommand.flags).map(([name, flag]) => {
          const flagNameWithAlias = [gracefulFlagName(name)];
          if (flag.alias) {
            flagNameWithAlias.push(gracefulFlagName(flag.alias));
          }
          const items = [pc.blue(flagNameWithAlias.join(", "))];
          items.push(DELIMITER, flag.description || NO_DESCRIPTION);
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
      title: NOTES,
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
  /**
   * Banner
   */
  banner?: string
  /**
   * Render type
   */
  renderer?: "cliffy" | "typer"
}
export const helpPlugin = ({
  command = true,
  showHelpWhenNoCommand = true,
  notes,
  examples,
  banner,
  renderer,
}: HelpPluginOptions = {}) => definePlugin({
  setup: (cli) => {
    const render = renderer === "cliffy" || !renderer ? renderCliffy : renderTyper;
    const printHelp = (s: string) => {
      banner && print(`${banner}\n`);
      print(s);
    };
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
            printHelp(generateSubcommandHelp(render, ctx, ctx.parameters.command));
          } else {
            printHelp(generateHelp(render, ctx, notes, examples));
          }
        });
    }

    cli.inspector((ctx, next) => {
      const helpFlag = ctx.raw.mergedFlags.h || ctx.raw.mergedFlags.help;
      if (!ctx.hasRootOrAlias && !ctx.raw._.length && showHelpWhenNoCommand && !helpFlag) {
        let str = "No command given.\n\n";
        str += generateHelp(render, ctx, notes, examples);
        str += "\n";
        printHelp(str);
        process.exit(1);
      } else if (helpFlag) {
        if (ctx.raw._.length) {
          if (ctx.called !== Root) {
            if (ctx.name === Root) {
              printHelp(generateHelp(render, ctx, notes, examples));
            } else {
              printHelp(generateSubcommandHelp(render, ctx, ctx.raw._));
            }
          }
        } else {
          printHelp(generateHelp(render, ctx, notes, examples));
        }
      } else {
        next();
      }
    });

    return cli;
  },
});
