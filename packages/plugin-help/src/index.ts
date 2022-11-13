/* eslint-disable no-console */
// TODO: unit tests
import type { CommandRecord, HandlerContext } from "clerc";
import { NoSuchCommandError, definePlugin, resolveCommand } from "clerc";
import pc from "picocolors";
import { generateFlagNameAndAliasFromCommand, generateNameAndAliasFromCommands, getPadLength } from "./utils";

const newline = () => { console.log(); };

interface Options {
  /**
   * Register a help command or not.
   */
  command?: boolean
  /**
   * [example command, description]
   */
  examples?: [string, string][]
  /**
   * notes
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
    if (command) {
      cli = cli.command("help", "Show help")
        .on("help", (ctx) => {
          showHelp(ctx, rest);
        });
    }
    cli = cli.inspector((_ctx, next) => {
      const ctx = _ctx as HandlerContext;
      if ((_ctx.flags.h || _ctx.flags.help)) {
        if (ctx.name === "help") {
          showSubcommandHelp({
            ...ctx,
            name: "help",
          });
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
      if (!ctx.resolved && ctx.parameters.length === 0 && Object.keys(ctx.flags).length === 0) {
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
  if (ctx.parameters.length > 0) {
    showSubcommandHelp(ctx);
    return;
  }
  cli._name && console.log(`${pc.green(cli._name)} ${cli._version}`);
  if (cli._description) {
    console.log(cli._description);
    newline();
  }
  console.log(pc.yellow("USAGE:"));
  console.log(`    ${cli._name || "<CLI NAME>"} <SUBCOMMAND> [OPTIONS]`);
  newline();
  console.log(pc.yellow("COMMANDS:"));
  const commandNameAndAlias = generateNameAndAliasFromCommands(cli._commands);
  const commandsPadLength = getPadLength(Object.values(commandNameAndAlias));
  for (const [name, nameAndAlias] of Object.entries(commandNameAndAlias)) {
    console.log(`    ${pc.green(nameAndAlias.padEnd(commandsPadLength))}${(cli._commands as CommandRecord)[name].description}`);
  }
  if (examples.length > 0) {
    newline();
    console.log(pc.yellow("EXAMPLES:"));
    const examplesPadLength = getPadLength(examples.map(e => e[0]));
    for (const [exampleCommand, exampleDescription] of examples) {
      console.log(`  ${exampleCommand.padEnd(examplesPadLength)}${exampleDescription}`);
    }
  }
  if (notes.length > 0) {
    newline();
    console.log(pc.yellow("NOTES:"));
    for (const note of notes) {
      console.log(`  ${note}`);
    }
  }
}

function showSubcommandHelp (ctx: HandlerContext) {
  const { cli } = ctx;
  const commandName = String(ctx.name || ctx.parameters[0]);
  const commandToShowHelp = resolveCommand(cli._commands, commandName);
  if (!commandToShowHelp) {
    throw new NoSuchCommandError(`No such command: ${commandName}`);
  }
  console.log(`${pc.green(`${cli._name}.${commandToShowHelp.name}`)} ${cli._version}`);
  commandToShowHelp.description && console.log(commandToShowHelp.description);
  newline();
  console.log(pc.yellow("USAGE:"));
  console.log(`    ${cli._name} ${commandToShowHelp.name} [PARAMETERS] [FLAGS]`);
  // const parameters = commandToShowHelp.parameters || {};
  // const parameterKeys = Object.keys(parameters);
  // if (parameterKeys.length > 0) {
  //   newline();
  //   console.log(pc.yellow("PARAMETERS:"));
  //   const parametersPadLength = getPadLength(parameterKeys);
  //   for (const [name, param] of Object.entries(parameters)) {
  //     const resuired = param.required ? pc.red(" (required)") : "";
  //     console.log(`    ${pc.green(name.padEnd(parametersPadLength))}${param.description}${resuired}`);
  //   }
  // }
  const flagNameAndAlias = generateFlagNameAndAliasFromCommand(commandToShowHelp);
  if (Object.keys(flagNameAndAlias).length > 0) {
    newline();
    console.log(pc.yellow("FLAGS:"));
    const flagsPadLength = getPadLength(Object.values(flagNameAndAlias));
    for (const [name, nameAndAlias] of Object.entries(flagNameAndAlias)) {
      console.log(`    ${pc.green(nameAndAlias.padEnd(flagsPadLength))}${commandToShowHelp.flags![name].description}`);
    }
  }
}
