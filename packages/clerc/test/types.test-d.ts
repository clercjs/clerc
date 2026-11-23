import { describe, expectTypeOf, it } from "vitest";

import { Cli, verbosityPlugin } from "../src";

describe("clerc plugin & built-in context type inference", () => {
  it("provides built-in ctx.help and accumulates plugin flags cleanly", () => {
    Cli({ scriptName: "app", version: "1.0.0" })
      .use(verbosityPlugin())
      .command("build", {
        run(ctx) {
          expectTypeOf(ctx.help.render).toBeFunction();
          expectTypeOf(ctx.help.print).toBeFunction();
          expectTypeOf(ctx.flags.quiet).toEqualTypeOf<boolean>();
          expectTypeOf(ctx.flags.verbose).toEqualTypeOf<number>();
        },
      });
  });
});
