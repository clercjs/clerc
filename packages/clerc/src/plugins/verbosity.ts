import { plugin } from "../cli";

export const verbosityPlugin = () =>
  plugin("clerc:verbosity")
    .flags({
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
    })
    .middleware(async (ctx, next) => {
      if (ctx.flags.quiet) {
        ctx.log.setLevel("error");
      } else if (ctx.flags.verbose > 0) {
        ctx.log.setLevel("debug");
      }

      await next();
    });
