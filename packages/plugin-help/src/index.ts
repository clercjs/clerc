/* eslint-disable no-console */
import type { Clerc, CommandRecord } from "clerc";
import { definePlugin } from "clerc";

// A simple to use, efficient, and full-featured Command Line Argument Parser

// Usage: 01_quick_derive[EXE] [OPTIONS] [NAME] [COMMAND]

// Commands:
//   test  does testing things
//   help  Print this message or the help of the given subcommand(s)

// Arguments:
//   [NAME]  Optional name to operate on

// Options:
//   -c, --config <FILE>  Sets a custom config file
//   -d, --debug...       Turn debugging information on
//   -h, --help           Print help information
//   -V, --version        Print version information

const newline = () => { console.log(); };

export const helpPlugin = definePlugin({
  setup<T extends Clerc<CommandRecord>>(cli: T): T {
    return cli.command("help", "Show help")
      .on("help", (_ctx) => {
        console.log(cli._description);
        newline();
        console.log("Usage: %s [OPTIONS] [NAME] [COMMAND]", cli._name);
        newline();
        console.log("Commands:");
        for (const command of Object.values(cli._commands)) {
          console.log("  %s\t%s", command.name, command.description);
        }
      });
  },
});
