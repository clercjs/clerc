import { describe, expectTypeOf, it } from "vitest";

import type { Logger } from "../src";
import { Cli, verbosityPlugin } from "../src";

describe("clerc plugin & built-in context type inference", () => {
  it("provides built-in ctx.help, ctx.log, and accumulates plugin flags cleanly", () => {
    Cli({ scriptName: "app", version: "1.0.0" })
      .use(verbosityPlugin())
      .command("build", {
        run(ctx) {
          expectTypeOf(ctx.help.render).toBeFunction();
          expectTypeOf(ctx.help.print).toBeFunction();
          expectTypeOf(ctx.log).toEqualTypeOf<Logger>();
          expectTypeOf(ctx.flags.quiet).toEqualTypeOf<boolean>();
          expectTypeOf(ctx.flags.verbose).toEqualTypeOf<number>();
        },
      });
  });
});
