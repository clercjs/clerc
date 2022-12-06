/* eslint-disable no-console */
// TODO: unit tests
// TODO: parameters
import type { Clerc, CommandRecord, HandlerContext } from "clerc";
import { NoSuchCommandError, SingleCommand, definePlugin, resolveCommand, resolveRootCommands } from "clerc";
import { generateCommandRecordFromCommandArray, gracefulVersion } from "@clerc/utils";
import pc from "picocolors";

import { generateFlagNameAndAliasFromCommand, generateNameAndAliasFromCommands, getPadLength, mergeFlags } from "./utils";

const newline = () => { console.log(); };
const getExamples = (cli: Clerc) => [
  [`${cli._name} help`, "Displays help of the cli"],
  [`${cli._name} -h`, "Displays help of the cli"],
  [`${cli._name} help help`, "Displays help of the help command"],
] as [string, string][];

interface Options {
  /**
   * Register a help command or not.
   */
  command?: boolean
  /**
   * Examples
   * Syntax: [example command, description]
   */
  examples?: [string, string][]
  /**
   * Notes
   */
  notes?: string[]
}
const defaultOptions: Required<Options> = {
  command: true,
  examples: [],
  notes: [],
};
export const helpPlugin = (_options?: Options) => definePlugin({
  setup (cli) {
    const { command, ...rest } = { ...defaultOptions, ..._options } as Required<Options>;
    cli.inspector((inspectorCtx, next) => {
      if (command && !inspectorCtx.isSingleCommand) {
        cli = cli.command("help", "Show help", {
          examples: getExamples(cli),
          parameters: [
            "[command...]",
          ],
        })
          .on("help", (ctx) => {
            showHelp(ctx, rest);
          });
      }
      const ctx = inspectorCtx as HandlerContext;
      const flags = mergeFlags(ctx);
      if ((flags.h || flags.help)) {
        if (ctx.isSingleCommand) {
          showSingleCommandHelp(ctx);
          return;
        }
        if (ctx.name === "help") {
          showSubcommandHelp(ctx);
          return;
        }
        if (ctx.resolved) {
          showSubcommandHelp(ctx);
        } else {
          showHelp(ctx, rest);
        }
        return;
      }
      // e.g: $ cli
      if (!ctx.resolved && ctx.raw._.length === 0 && Object.keys(flags).length === 0) {
        showHelp(ctx, rest);
        return;
      }
      next();
    });
    return cli;
  },
});

type ShowHelpOptions = Required<Omit<Options, "command">>;
function showHelp (ctx: HandlerContext, { examples, notes }: ShowHelpOptions) {
  const { cli } = ctx;
  // When parameters are passed, treat them as subcommand.
  if (ctx.resolved && ctx.parameters!.command!.length > 0) {
    showSubcommandHelp(ctx);
    return;
  }
  // Name
  cli._name && console.log(`${pc.green(cli._name)} ${gracefulVersion(cli._version)}`);
  // Description
  if (cli._description) {
    console.log(cli._description);
    newline();
  }
  // Usage
  console.log(pc.yellow("USAGE:"));
  console.log(`    ${cli._name || "<CLI NAME>"} <SUBCOMMAND> [OPTIONS]`);
  newline();
  // Commands
  console.log(pc.yellow("COMMANDS:"));
  const commandNameAndAlias = generateNameAndAliasFromCommands(generateCommandRecordFromCommandArray(resolveRootCommands(cli._commands)));
  const commandsPadLength = getPadLength(Object.values(commandNameAndAlias));
  for (const [name, nameAndAlias] of Object.entries(commandNameAndAlias)) {
    console.log(`    ${pc.green(nameAndAlias.padEnd(commandsPadLength))}${(cli._commands as CommandRecord)[name].description}`);
  }
  // Examples
  if (examples.length > 0) {
    newline();
    console.log(pc.yellow("EXAMPLES:"));
    const examplesPadLength = getPadLength(examples.map(e => e[0]));
    for (const [exampleCommand, exampleDescription] of examples) {
      console.log(`  ${exampleCommand.padEnd(examplesPadLength)}${exampleDescription}`);
    }
  }
  // Notes
  showCommandNotes(notes);
}

function showCommandExamples (examples?: [string, string][]) {
  if (examples && examples.length > 0) {
    newline();
    console.log(pc.yellow("EXAMPLES:"));
    const examplesPadLength = getPadLength(examples.map(e => e[0]));
    for (const [exampleCommand, exampleDescription] of examples) {
      console.log(`  ${exampleCommand.padEnd(examplesPadLength)}${exampleDescription}`);
    }
  }
}

function showCommandNotes (notes?: string[]) {
  if (notes && notes.length > 0) {
    newline();
    console.log(pc.yellow("NOTES:"));
    for (const note of notes) {
      console.log(`  ${note}`);
    }
  }
}

function showSubcommandHelp (ctx: HandlerContext) {
  const { cli } = ctx;
  const commandName = ctx.parameters!.command as string[];
  const commandToShowHelp = resolveCommand(cli._commands, commandName);
  if (!commandToShowHelp) {
    throw new NoSuchCommandError(commandName.join(" "));
  }
  // Name, command name and version
  console.log(`${pc.green(`${cli._name} ${commandToShowHelp.name}`)} ${gracefulVersion(cli._version)}`);
  // Description
  commandToShowHelp.description && console.log(commandToShowHelp.description);
  // Usage;
  newline();
  console.log(pc.yellow("USAGE:"));
  console.log(`    ${cli._name} ${commandToShowHelp.name} [PARAMETERS] [FLAGS]`);
  // Flags
  const flagNameAndAlias = generateFlagNameAndAliasFromCommand(commandToShowHelp);
  if (Object.keys(flagNameAndAlias).length > 0) {
    newline();
    console.log(pc.yellow("FLAGS:"));
    const flagsPadLength = getPadLength(Object.values(flagNameAndAlias));
    for (const [name, nameAndAlias] of Object.entries(flagNameAndAlias)) {
      console.log(`    ${pc.green(nameAndAlias.padEnd(flagsPadLength))}${commandToShowHelp.flags![name].description}`);
    }
  }
  showCommandExamples(commandToShowHelp.examples);
  showCommandNotes(commandToShowHelp.notes);
}

function showSingleCommandHelp (ctx: HandlerContext) {
  const { cli } = ctx;
  const singleCommand = cli._commands[SingleCommand]!;
  console.log(`${pc.green(`${cli._name} ${gracefulVersion(cli._version)}`)}`);
  singleCommand.description && console.log(singleCommand.description);
  newline();
  console.log(pc.yellow("USAGE:"));
  console.log(`    ${cli._name} [PARAMETERS] [FLAGS]`);
  const flagNameAndAlias = generateFlagNameAndAliasFromCommand(singleCommand);
  if (Object.keys(flagNameAndAlias).length > 0) {
    newline();
    console.log(pc.yellow("FLAGS:"));
    const flagsPadLength = getPadLength(Object.values(flagNameAndAlias));
    for (const [name, nameAndAlias] of Object.entries(flagNameAndAlias)) {
      console.log(`    ${pc.green(nameAndAlias.padEnd(flagsPadLength))}${singleCommand.flags![name].description}`);
    }
  }
  showCommandExamples(singleCommand.examples);
  showCommandNotes(singleCommand.notes);
}
