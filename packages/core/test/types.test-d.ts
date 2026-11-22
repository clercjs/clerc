import { describe, expectTypeOf, it } from "vitest";

import type { StandardSchemaV1 } from "../src";
import { Clerc, Types, defineCommand, definePlugin } from "../src";

describe("core v2 types", () => {
  it("infers parameters, flags, global flags, and overrides strictly without index pollution", () => {
    const portSchema = {} as StandardSchemaV1<string, number>;

    Clerc.create()
      .globalFlag("config", { type: String, default: "clerc.json" })
      .globalFlag("overrideMe", { type: String, default: "str" })
      .command(
        "deploy",
        {
          parameters: [
            "<env>",
            "[region]",
            "[files...]",
            { key: "<mode>", type: Types.Enum("fast", "safe") },
          ] as const,
          flags: {
            port: { type: portSchema, required: true },
            dryRun: Boolean,
            overrideMe: { type: Number, default: 42 },
          },
        },
        (ctx) => {
          expectTypeOf(ctx.parameters).toEqualTypeOf<{
            env: string;
            region: string | undefined;
            files: string[];
            mode: "fast" | "safe";
          }>();
          expectTypeOf(ctx.flags.config).toEqualTypeOf<string>();
          expectTypeOf(ctx.flags.port).toEqualTypeOf<number>();
          expectTypeOf(ctx.flags.dryRun).toEqualTypeOf<boolean>();
          expectTypeOf(ctx.flags.overrideMe).toEqualTypeOf<number>();

          // @ts-expect-error non-existent flag must be a compile error (no Record<string, any> pollution!)
          void ctx.flags.nonExistentTypo;
        },
      );
  });

  it("accumulates plugin globalFlags and extendContext types across .use()", () => {
    const authPlugin = definePlugin({
      name: "auth",
      globalFlags: {
        token: { type: String },
      } as const,
      extendContext: () => ({
        auth: {
          getUser: (): string => "ray",
        },
      }),
    });

    Clerc.create()
      .use(authPlugin)
      .command("me", {
        run: (ctx) => {
          expectTypeOf(ctx.flags.token).toEqualTypeOf<string | undefined>();
          expectTypeOf(ctx.auth.getUser()).toEqualTypeOf<string>();
        },
      });
  });

  it("infers types cleanly in standalone defineCommand (1-arg and 2-arg)", () => {
    defineCommand({
      name: "build",
      parameters: ["<entry>"] as const,
      flags: {
        minify: { type: Boolean, default: true },
      },
      run: (ctx) => {
        expectTypeOf(ctx.parameters.entry).toEqualTypeOf<string>();
        expectTypeOf(ctx.flags.minify).toEqualTypeOf<boolean>();
      },
    });

    defineCommand(
      {
        name: "release",
        parameters: [
          { key: "<channel>", type: Types.Enum("alpha", "beta") },
        ] as const,
        flags: {
          tag: String,
        },
      },
      (ctx) => {
        expectTypeOf(ctx.parameters.channel).toEqualTypeOf<"alpha" | "beta">();
        expectTypeOf(ctx.flags.tag).toEqualTypeOf<string | undefined>();
      },
    );
  });
});
