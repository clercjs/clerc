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
    .middleware(
      (ctx, next) => {
        if (ctx.flags.quiet) {
          ctx.log.level = "error";
        } else if (ctx.flags.verbose > 0) {
          ctx.log.level = "debug";
        }

        return next();
      },
      { enforce: "pre" },
    );
