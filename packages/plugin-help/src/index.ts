/* eslint-disable no-console */
import type { CommandRecord } from "clerc";
import { definePlugin } from "clerc";

// (desc)

// Usage: (name)[EXE] [OPTIONS] [NAME] [COMMAND]

// Commands:
//   test  does testing things
//   help  Print this message or the help of the given subcommand(s)

const newline = () => { console.log(); };

export const helpPlugin = definePlugin({
  setup (cli) {
    return cli.command("help", "Show help")
      .on("help", (_ctx) => {
        console.log(cli._description);
        newline();
        console.log("Usage: %s [OPTIONS] [NAME] [COMMAND]", cli._name);
        newline();
        console.log("Commands:");
        for (const command of Object.values(cli._commands as CommandRecord)) {
          console.log("  %s\t%s", command.name, command.description);
        }
      });
  },
});
