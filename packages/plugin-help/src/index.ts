
// TODO: unit tests
// TODO: parameters
import type { Clerc, Command, HandlerContext } from "@clerc/core";
import { NoSuchCommandError, definePlugin, resolveCommand } from "@clerc/core";
import { gracefulFlagName } from "@clerc/utils";
import pc from "picocolors";

import type { Section } from "./renderer";
import { render } from "./renderer";
import { table } from "./utils";

const DELIMITER = pc.yellow("-");

const generateCliDetail = (sections: Section[], cli: Clerc, subcommand?: Command) => {
  const items = [
    {
      title: pc.gray("Name:"),
      body: pc.red(cli._name),
    },
    {
      title: pc.gray("Version:"),
      body: pc.yellow(cli._version),
    },
  ];
  if (subcommand) {
    items.push({
      title: pc.gray("Subcommand:"),
      body: pc.green(subcommand.name),
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
    body: table(...examplesFormatted).toString().split("\n"),
  });
};

const showHelp = (ctx: HandlerContext, notes: string[] | undefined, examples: [string, string][] | undefined) => {
  const { cli } = ctx;
  const sections = [] as Section[];
  generateCliDetail(sections, cli);
  if (ctx.isSingleCommand) {
    sections.push({
      title: "Usage:",
      body: [`$ ${cli._name} [options]`],
    });
  } else {
    sections.push({
      title: "Usage:",
      body: [`$ ${cli._name} [command] [options]`],
    });
  }
  if (!ctx.isSingleCommand) {
    sections.push({
      title: "Commands:",
      body: Object.values(cli._commands).map((command) => {
        return table([pc.cyan(command.name), DELIMITER, command.description]).toString();
      }),
    });
  }
  if (notes) {
    sections.push({
      title: "Notes:",
      body: notes,
    });
  }
  if (examples) {
    generateExamples(sections, examples);
  }
  process.stdout.write(render(sections));
};

const showSubcommandHelp = (ctx: HandlerContext, command: string[]) => {
  const { cli } = ctx;
  const subcommand = resolveCommand(cli._commands, command);
  if (!subcommand) {
    throw new NoSuchCommandError(command.join(" "));
  }
  const sections = [] as Section[];
  generateCliDetail(sections, cli, subcommand);
  const parameters = subcommand.parameters?.join(", ") || "";
  sections.push({
    title: "Usage:",
    body: [`$ ${cli._name} ${subcommand.name}${parameters ? ` ${parameters}` : ""} [options]`],
  });
  if (subcommand.flags) {
    sections.push({
      title: "Flags:",
      body: Object.entries(subcommand.flags).map(([name, flag]) => {
        const flagNameWithAlias = [gracefulFlagName(name)];
        if (flag.alias) {
          flagNameWithAlias.push(gracefulFlagName(flag.alias));
        }
        const items = [pc.blue(flagNameWithAlias.join(", "))];
        if (flag.description) {
          items.push(DELIMITER, flag.description);
        }
        if (flag.type) {
          const type = Array.isArray(flag.type)
            ? `Array<${flag.type[0].name}>`
            : (flag.type as any).name;
          items.push(pc.gray(`(${type})`));
        }
        return table(items).toString();
      }),
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
  process.stdout.write(render(sections));
};

export interface HelpPluginOptions {
  /**
   * Whether to registr the help command.
   * @default true
   */
  command?: boolean
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
            showSubcommandHelp(ctx, ctx.parameters.command);
          } else {
            showHelp(ctx, notes, examples);
          }
        });
    }

    cli.inspector((ctx, next) => {
      if (ctx.raw.mergedFlags.h || ctx.raw.mergedFlags.help) {
        if (ctx.raw._.length) {
          showSubcommandHelp(ctx, ctx.raw._);
        } else {
          showHelp(ctx, notes, examples);
        }
      } else {
        next();
      }
    });

    return cli;
  },
});
