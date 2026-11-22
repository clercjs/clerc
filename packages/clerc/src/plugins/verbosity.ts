import { definePlugin } from "@clerc/core";

export const verbosityPlugin = () =>
  definePlugin({
    name: "clerc:verbosity",
    globalFlags: {
      quiet: {
        type: Boolean,
        short: "q",
        description: "Suppress non-error output",
      },
      verbose: {
        type: [Boolean],
        short: "v",
        description: "Enable verbose debug logging",
      },
    } as const,
    hooks: {
      onIntercept: (ctx) => {
        if (ctx.flags.quiet) {
          ctx.log.setLevel("error");
        } else if (ctx.flags.verbose > 0) {
          ctx.log.setLevel("debug");
        }
      },
    },
  });
