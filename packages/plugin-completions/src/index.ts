/* eslint-disable no-console */
// TODO: unit tests
import { NoSuchCommandError, definePlugin } from "clerc";
import { getPwshCompletion } from "./completions/pwsh";

const completionMap = {
  pwsh: getPwshCompletion,
};

export interface Options {
  command?: boolean
}
export const completionsPlugin = (options: Options = {}) => definePlugin({
  setup (cli) {
    const { command = true } = options;
    if (command) {
      cli = cli.command("completions", "Print shell completions to stdout")
        .on("completions", (ctx) => {
          if (!cli.name) {
            throw new Error("CLI name is not defined!");
          }
          const shell = String(ctx.parameters[0]);
          if (!shell) {
            throw new Error("Missing shell name");
          }
          if (shell in completionMap) {
            console.log(completionMap[shell as keyof typeof completionMap](ctx));
          } else {
            throw new NoSuchCommandError(`No such shell: ${shell}`);
          }
        });
    }
    return cli;
  },
});
