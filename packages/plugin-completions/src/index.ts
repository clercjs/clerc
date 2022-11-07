/* eslint-disable no-console */
// TODO: unit tests
import { definePlugin } from "clerc";
import { getPwshCompletion } from "./completions/pwsh";

export interface Options {
  command?: boolean
}
export const completionsPlugin = (options: Options = {}) => definePlugin({
  setup (cli) {
    const { command = true } = options;
    if (command) {
      cli = cli.command("completions", "Print shell completions to stdout")
        .on("completions", (ctx) => {
          switch (ctx.parameters[0]) {
            case "pwsh":
              console.log(getPwshCompletion(ctx));
              break;
            default:
              throw new Error(`Unknown shell: ${ctx.parameters[0]}`);
          }
        });
    }
    return cli;
  },
});
