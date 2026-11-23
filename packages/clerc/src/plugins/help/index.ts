import type { MetaAsyncGetter, Plugin } from "@clerc/core";
import { UnknownCommandError, plugin } from "@clerc/core";

import type { RenderHelpOptions } from "./renderer";
import { renderHelp } from "./renderer";

export type { RenderHelpOptions };
export { renderHelp };

export interface HelpPluginOptions<Flag extends boolean = true> {
  readonly command?: boolean;
  readonly flag?: Flag;
  readonly showHelpWhenNoCommandSpecified?: boolean;
  readonly header?: MetaAsyncGetter<string | undefined | void>;
  readonly footer?: MetaAsyncGetter<string | undefined | void>;
}

export interface HelpContext {
  readonly help: {
    readonly render: (commandPath?: readonly string[]) => Promise<string>;
    readonly print: (commandPath?: readonly string[]) => Promise<void>;
  };
}

const HELP_FLAG = {
  type: Boolean,
  short: "h",
  description: "Show help",
} as const;

export function helpPlugin<const Flag extends boolean = true>(
  options?: HelpPluginOptions<Flag>,
) {
  const {
    command = true,
    flag = true,
    showHelpWhenNoCommandSpecified = true,
    header,
    footer,
  } = options ?? {};

  const p = plugin("clerc:help").extend((ctx) => {
    const render = (commandPath?: readonly string[]): Promise<string> =>
      renderHelp(ctx.model, {
        node: commandPath
          ? ctx.model.tree.findNode(commandPath)
          : ctx.model.tree.root,
        theme: ctx.theme,
        columns: ctx.terminal.columns,
        header,
        footer,
      });

    return {
      help: {
        render,
        print: async (commandPath?: readonly string[]) => {
          ctx.terminal.stdout(await render(commandPath));
        },
      },
    };
  });

  if (command) {
    p.command("help [command...]", {
      description: "Show help for a command",
      examples: (meta) => [
        [`$ ${meta.scriptName} help`, "Show general help"],
        [`$ ${meta.scriptName} help <command>`, "Show help for a command"],
      ],
      async run(ctx) {
        const path = ctx.args.command;
        if (path.length > 0 && !ctx.model.tree.findNode(path)) {
          throw new UnknownCommandError(path.join(" "), []);
        }
        await ctx.help.print(path.length > 0 ? path : undefined);
      },
    });
  }

  if (flag) {
    p.flags({ help: HELP_FLAG });
  }

  p.hook("intercept", async (ctx) => {
    const hasPositionals = (ctx.rawParsed?.parameters.length ?? 0) > 0;
    const explicitHelp =
      flag &&
      Boolean(ctx.flags.help) &&
      (Boolean(ctx.command) ||
        ctx.node !== ctx.model.tree.root ||
        !hasPositionals);
    const implicitHelp =
      showHelpWhenNoCommandSpecified && !ctx.command && !hasPositionals;

    if (explicitHelp || implicitHelp) {
      await ctx.help.print(ctx.node?.fullPath);

      return { handled: true, exitCode: 0 };
    }
  });

  return p as Plugin<
    Flag extends true ? { readonly help: typeof HELP_FLAG } : {},
    HelpContext
  >;
}
