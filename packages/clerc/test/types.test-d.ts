import { describe, expectTypeOf, it } from "vitest";

import {
  Cli,
  createCli,
  helpPlugin,
  verbosityPlugin,
  versionPlugin,
} from "../src";

describe("clerc plugin type inference", () => {
  it("infers Cli() default flags and help context", () => {
    Cli({ scriptName: "app", version: "1.0.0" }).command("build", {
      run(ctx) {
        expectTypeOf(ctx.flags.help).toEqualTypeOf<boolean>();
        expectTypeOf(ctx.flags.version).toEqualTypeOf<boolean>();
        expectTypeOf(ctx.help.render).toBeFunction();
      },
    });
  });

  it("infers verbosityPlugin and optional help/version flags accurately", () => {
    createCli({ scriptName: "app", version: "1.0.0" })
      .use(verbosityPlugin())
      .command("a", {
        run(ctx) {
          expectTypeOf(ctx.flags.quiet).toEqualTypeOf<boolean>();
          expectTypeOf(ctx.flags.verbose).toEqualTypeOf<number>();
        },
      });

    createCli({ scriptName: "app", version: "1.0.0" })
      .use(versionPlugin({ flag: false }))
      .use(helpPlugin({ flag: false }))
      .command("b", {
        run(ctx) {
          // @ts-expect-error version flag is disabled
          void ctx.flags.version;
          // @ts-expect-error help flag is disabled
          void ctx.flags.help;
        },
      });
  });
});
