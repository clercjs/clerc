import { describe, expectTypeOf, it } from "vitest";

import type { FlagsDefinition, Logger, StandardSchemaV1 } from "../src";
import { Complete, Types, clerc, plugin } from "../src";
import type { ExtractArgNames } from "../src/args";

import "@clerc/plugin-completions";
import "@clerc/plugin-mcp";

declare module "../src" {
  interface CustomState {
    readonly requestId?: string;
  }
}

describe("core v2 route-signature & plugin types", () => {
  it("infers args from signature strings without as const and type-checks args keys", () => {
    const portSchema = {} as StandardSchemaV1<string, number>;

    const cli = clerc({ name: "app", version: "1.0.0" }).flags({
      config: { type: String, default: "clerc.json" },
      overrideMe: { type: String, default: "str" },
    });

    cli.command("deploy <env> [region] <mode> [files...]", {
      args: {
        mode: { type: Types.Enum("fast", "safe") },
      },
      flags: {
        port: { type: portSchema, required: true },
        dryRun: Boolean,
        overrideMe: { type: Number, default: 42 },
      },
      run(ctx) {
        expectTypeOf(ctx.args).toEqualTypeOf<{
          env: string;
          region: string | undefined;
          mode: "fast" | "safe";
          files: string[];
        }>();
        expectTypeOf(ctx.flags.config).toEqualTypeOf<string>();
        expectTypeOf(ctx.flags.port).toEqualTypeOf<number>();
        expectTypeOf(ctx.flags.dryRun).toEqualTypeOf<boolean>();
        expectTypeOf(ctx.flags.overrideMe).toEqualTypeOf<number>();

        // @ts-expect-error non-existent flag must be a compile error
        void ctx.flags.nonExistentTypo;
      },
    });

    cli.command("build <entry>", {
      args: {
        // @ts-expect-error unknown arg key not in signature must be a compile error
        typoKey: String,
      },
    });

    // @ts-expect-error empty string spec must be rejected in favor of command(options)
    cli.command("", { run() {} });

    clerc({ name: "serve" }).command({
      flags: { port: { type: Number, default: 3000 } },
      run(ctx) {
        expectTypeOf(ctx.args).toEqualTypeOf<{}>();
        expectTypeOf(ctx.flags.port).toEqualTypeOf<number>();
      },
    });

    cli.command("augmented", {
      meta: {
        mcp: { idempotent: true, readOnly: true },
        customKey: 123,
      },
      complete: false,
      flags: {
        env: {
          type: String,
          complete({ current }) {
            expectTypeOf(current).toEqualTypeOf<string>();

            return [{ value: "prod", description: "Production" }];
          },
        },
        config: {
          type: String,
          complete: Complete.file("ts", "json"),
        },
        outDir: {
          type: String,
          complete: Complete.dir(),
        },
        target: {
          type: String,
          complete: Complete.list(["alpha", "beta"], {
            keepOrder: true,
            noSpace: true,
            allowFiles: true,
          }),
        },
        secret: {
          type: String,
          complete: Complete.none,
        },
        region: {
          type: String,
          complete: [
            "us-east-1",
            { value: "eu-west-1", description: "Europe" },
          ],
        },
      },
    });

    cli.command("bad-meta", {
      meta: {
        // @ts-expect-error augmented McpCommandMeta must reject wrong value types
        mcp: { idempotent: "nope" },
      },
    });

    const reusableFlags: FlagsDefinition = { debug: Boolean };
    cli.flags(reusableFlags);

    cli.command("check <entry>", {
      args: {
        // @ts-expect-error unknown option key inside arg options must be a compile error
        entry: { unknownOption: true },
      },
      flags: {
        // @ts-expect-error unknown option key inside flag options must be a compile error
        badFlag: { type: Boolean, unknownOption: true },
      },
    });
  });

  it("accumulates plugin flags and middleware next({ ... }) state into ctx.state cleanly", () => {
    const authPlugin = plugin("auth")
      .flags({ token: String })
      .middleware((_ctx, next) =>
        next({
          auth: {
            getUser: (): string => "ray",
          },
        }),
      );

    const cli = clerc({ name: "app", version: "1.0.0" })
      .use(authPlugin)
      .middleware(
        (ctx, next) => {
          // @ts-expect-error enforce: "pre" runs before normal middlewares so auth is not yet available
          void ctx.state.auth;

          return next({ traceId: "req-1" });
        },
        { enforce: "pre" },
      )
      .middleware(async (ctx, next) => {
        expectTypeOf(ctx.state.auth.getUser()).toEqualTypeOf<string>();
        expectTypeOf(ctx.state.traceId).toEqualTypeOf<string>();
        await next();
      });

    cli.command("me", {
      run(ctx) {
        expectTypeOf(ctx.flags.token).toEqualTypeOf<string | undefined>();
        expectTypeOf(ctx.state.auth.getUser()).toEqualTypeOf<string>();
        expectTypeOf(ctx.state.traceId).toEqualTypeOf<string>();
        expectTypeOf(ctx.state.requestId).toEqualTypeOf<string | undefined>();

        // @ts-expect-error non-existent state key must be a compile error
        void ctx.state.nonExistentStateKey;
      },
    });
  });

  it("infers Standard Schema v1 output from both types.output and validate return", () => {
    const typesOnlySchema = {
      "~standard": {
        version: 1 as const,
        vendor: "mock-zod",
        validate: (v: unknown): { readonly value: unknown } => ({ value: v }),
        types: undefined as
          { readonly input: string; readonly output: Date } | undefined,
      },
    };
    const validateOnlySchema = {
      "~standard": {
        version: 1 as const,
        vendor: "mock-custom",
        validate: (v: unknown) => ({ value: Number(v) }),
      },
    };

    clerc({ name: "app", version: "1.0.0" }).command("sync <at>", {
      args: { at: typesOnlySchema },
      flags: { retries: { type: validateOnlySchema, required: true } },
      run(ctx) {
        expectTypeOf(ctx.args.at).toEqualTypeOf<Date>();
        expectTypeOf(ctx.flags.retries).toEqualTypeOf<number>();
      },
    });
  });

  it("infers args and flags inside standalone plugin().command() cleanly", () => {
    plugin("release").command("release <channel>", {
      args: { channel: Types.Enum("alpha", "beta") },
      flags: { tag: String },
      run(ctx) {
        expectTypeOf(ctx.args.channel).toEqualTypeOf<"alpha" | "beta">();
        expectTypeOf(ctx.flags.tag).toEqualTypeOf<string | undefined>();
      },
    });
  });

  it("infers arg default types and optional-value implicitValue flag types", () => {
    clerc({ name: "app", version: "1.0.0" }).command(
      "deploy [region] [files...]",
      {
        args: {
          region: { type: String, default: "us-east-1" },
          files: { type: String, default: ["index.ts"] },
        },
        flags: {
          inspect: { type: Number, implicitValue: 9229 },
          color: {
            type: Types.Enum("auto", "always", "never"),
            default: "auto",
            implicitValue: "always",
          },
          tags: {
            type: String,
            multiple: true,
            delimiter: ",",
            aliases: ["tag"],
            default: ["latest"],
          },
          port: { type: Number, default: () => 3000 },
          cache: { type: Boolean, default: () => true },
          modes: {
            type: Types.Enum("fast", "safe"),
            multiple: true,
            default: ["fast"],
          },
          verbose: Types.Counter,
        },
        run(ctx) {
          expectTypeOf(ctx.args.region).toEqualTypeOf<string>();
          expectTypeOf(ctx.args.files).toEqualTypeOf<string[]>();
          expectTypeOf(ctx.flags.inspect).toEqualTypeOf<number | undefined>();
          expectTypeOf(ctx.flags.color).toEqualTypeOf<
            "auto" | "always" | "never"
          >();
          expectTypeOf(ctx.flags.tags).toEqualTypeOf<string[]>();
          expectTypeOf(ctx.flags.port).toEqualTypeOf<number>();
          expectTypeOf(ctx.flags.cache).toEqualTypeOf<boolean>();
          expectTypeOf(ctx.flags.modes).toEqualTypeOf<("fast" | "safe")[]>();
          expectTypeOf(ctx.flags.verbose).toEqualTypeOf<number>();
        },
      },
    );
  });
  it("provides built-in ctx.help, ctx.log, and extracts double-dash arg names", () => {
    clerc({ name: "app", version: "1.0.0" }).command("build", {
      run(ctx) {
        expectTypeOf(ctx.help.render).toBeFunction();
        expectTypeOf(ctx.help.print).toBeFunction();
        expectTypeOf(ctx.log).toEqualTypeOf<Logger>();
        expectTypeOf(ctx.raw.argv).toEqualTypeOf<readonly string[]>();
        expectTypeOf(ctx.raw.doubleDash).toEqualTypeOf<readonly string[]>();
        expectTypeOf<
          ExtractArgNames<"exec <cmd> -- [args...]">
        >().toEqualTypeOf<"cmd" | "args">();
      },
    });
  });

  it("types r.flag() and r.arg() strictly inside rules", () => {
    clerc({ name: "app", version: "1.0.0" })
      .flags({ json: Boolean })
      .command("format [files...]", {
        flags: { stdin: Boolean, yaml: Boolean },
        rules: ({ exclusive, oneOf, flag, arg }) => [
          exclusive(flag("json"), flag("yaml")),
          exclusive(flag("stdin"), arg("files")),
          oneOf(arg("files"), flag("stdin")),
          // @ts-expect-error bare strings without flag()/arg() must be rejected
          exclusive("json", "yaml"),
          // @ts-expect-error unknown flag key must be rejected at compile time
          exclusive(flag("json"), flag("yml")),
          // @ts-expect-error unknown arg key must be rejected at compile time
          oneOf(arg("missing"), flag("stdin")),
        ],
        run() {},
      });
  });

  it("infers inherited and overridden flags & middleware state across scope() and subcommand()", () => {
    const cli = clerc({ name: "uptarn", version: "1.0.0" }).flags({
      globalFlag: Boolean,
    });

    const admin = cli
      .scope({ group: "admin" })
      .flags({
        server: { type: String, required: true },
        token: Types.String({ trim: true, nonEmpty: true }),
      })
      .middleware((ctx, next) => {
        expectTypeOf(ctx.flags.server).toEqualTypeOf<string>();
        expectTypeOf(ctx.flags.globalFlag).toEqualTypeOf<boolean>();

        return next({ client: { ping: (): boolean => true } });
      });

    const node = admin
      .subcommand("node", { description: "Manage nodes" })
      .flags({
        server: { type: String }, // override required -> optional
        limit: Types.Integer({ min: 0 }),
        ratio: Types.Number({ min: 0, max: 1 }),
      });

    node.command("order <ids...>", {
      default: true,
      args: {
        ids: { unique: true, minItems: 1 },
      },
      flags: {
        tags: { type: String, multiple: true, unique: true, maxItems: 5 },
      },
      rules: [
        (r) => [r.atLeastOne(r.group("fields"))],
        {
          description: "custom check",
          check(ctx) {
            expectTypeOf(ctx.args.ids).toEqualTypeOf<string[]>();
            expectTypeOf(ctx.flags.server).toEqualTypeOf<string | undefined>();
            expectTypeOf(ctx.flags.limit).toEqualTypeOf<number | undefined>();

            return { message: "bad", hints: ["try again"] };
          },
        },
      ],
      run(ctx) {
        expectTypeOf(ctx.flags.globalFlag).toEqualTypeOf<boolean>();
        expectTypeOf(ctx.flags.server).toEqualTypeOf<string | undefined>();
        expectTypeOf(ctx.flags.token).toEqualTypeOf<string | undefined>();
        expectTypeOf(ctx.flags.limit).toEqualTypeOf<number | undefined>();
        expectTypeOf(ctx.flags.ratio).toEqualTypeOf<number | undefined>();
        expectTypeOf(ctx.flags.tags).toEqualTypeOf<string[]>();
        expectTypeOf(ctx.state.client.ping()).toEqualTypeOf<boolean>();
      },
    });
  });
});
