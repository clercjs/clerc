import { describe, expectTypeOf, it } from "vitest";

import type {
  CheckFn,
  CliContext,
  CommandContext,
  FlagsDefinition,
  Logger,
  MiddlewareContext,
  MiddlewareOptions,
  StandardSchemaV1,
} from "../src";
import {
  ClercError,
  Complete,
  ConstraintError,
  Types,
  atLeastOne,
  cli,
  command,
  exclusive,
  group,
  middleware,
  oneOf,
  together,
  use,
} from "../src";
import type { ExtractArgNames } from "../src/args";

import "@clerc/plugin-completions";
import "@clerc/plugin-mcp";

declare module "../src" {
  interface CustomState {
    readonly requestId?: string;
  }
}

describe("core combinator static types & discriminated union narrowing", () => {
  it("infers args from signature strings without as const and type-checks args/flags option keys", () => {
    const portSchema = {} as StandardSchemaV1<string, number>;

    const globalMw = middleware({
      flags: {
        config: { type: String, default: "clerc.json" },
        overrideMe: { type: String, default: "str" },
      },
    });

    command("deploy <env> [region] <mode> [files...]", {
      use: [globalMw],
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

    command("build <entry>", {
      args: {
        // @ts-expect-error unknown arg key not in signature must be a compile error
        typoKey: String,
      },
    });

    // @ts-expect-error empty string spec must be rejected
    command("", { run() {} });

    cli({
      name: "serve",
      flags: { port: { type: Number, default: 3000 } },
      run(ctx) {
        expectTypeOf(ctx.args).toEqualTypeOf<{}>();
        expectTypeOf(ctx.flags.port).toEqualTypeOf<number>();
      },
    });

    cli("[files...]", {
      name: "bumpp",
      version: "1.0.0",
      flags: {
        release: {
          type: Types.Enum("patch", "minor", "major"),
          default: "patch",
        },
        yes: Boolean,
      },
      run(ctx) {
        expectTypeOf(ctx.args.files).toEqualTypeOf<string[]>();
        expectTypeOf(ctx.flags.release).toEqualTypeOf<
          "patch" | "minor" | "major"
        >();
        expectTypeOf(ctx.flags.yes).toEqualTypeOf<boolean>();
      },
    });

    command("augmented", {
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

    command("bad-meta", {
      meta: {
        // @ts-expect-error augmented McpCommandMeta must reject wrong value types
        mcp: { idempotent: "nope" },
      },
    });

    const reusableFlags: FlagsDefinition = { debug: Boolean };
    command("reusable", { flags: reusableFlags });

    command("check <entry>", {
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

  it("narrows oneOf, together, and exclusive flags as TypeScript discriminated unions", () => {
    const hubAuth = middleware({
      flags: group("Connection & Auth", [
        { server: { type: String, required: true } },
        oneOf(
          { token: { type: String, required: true } },
          { tokenFile: { type: String, required: true } },
        ),
      ]),
      async setup(ctx) {
        expectTypeOf(ctx.flags.server).toEqualTypeOf<string>();
        expectTypeOf(ctx.flags.token).toEqualTypeOf<string | undefined>();
        expectTypeOf(ctx.flags.tokenFile).toEqualTypeOf<string | undefined>();

        // When token is undefined via ??, tokenFile narrows to string!
        const resolved =
          ctx.flags.token ??
          (() => {
            expectTypeOf(ctx.flags.tokenFile).toEqualTypeOf<string>();

            return ctx.flags.tokenFile;
          })();
        expectTypeOf(resolved).toEqualTypeOf<string>();

        return {
          client: {
            token: resolved,
            ping: (): boolean => true,
          },
        };
      },
    });

    const withDb = middleware({
      flags: { dbUrl: { type: String, default: "sqlite://local.db" } },
      async setup(ctx) {
        return {
          db: {
            url: ctx.flags.dbUrl,
            close: async (): Promise<void> => {},
          },
        };
      },
      async run(ctx, next) {
        // Sibling run() sees db from setup() automatically!
        expectTypeOf(ctx.state.db.url).toEqualTypeOf<string>();
        try {
          await next();
        } finally {
          await ctx.state.db.close();
        }
      },
    });

    const deploy = command("deploy <env>", {
      use: [hubAuth, withDb],
      flags: [
        {
          port: { type: Types.Integer({ min: 1, max: 65_535 }), default: 3000 },
        },
        exclusive({ json: Boolean }, { yaml: Boolean }),
        group(
          "TLS Options",
          together({
            cert: { type: String, required: true },
            key: { type: String, required: true },
          }),
        ),
      ],
      run(ctx) {
        expectTypeOf(ctx.flags.port).toEqualTypeOf<number>();
        expectTypeOf(ctx.flags.server).toEqualTypeOf<string>();
        expectTypeOf(ctx.flags.json).toEqualTypeOf<boolean>();
        expectTypeOf(ctx.flags.yaml).toEqualTypeOf<boolean>();
        expectTypeOf(ctx.flags.cert).toEqualTypeOf<string | undefined>();
        expectTypeOf(ctx.flags.key).toEqualTypeOf<string | undefined>();

        if (ctx.flags.cert) {
          expectTypeOf(ctx.flags.cert).toEqualTypeOf<string>();
          expectTypeOf(ctx.flags.key).toEqualTypeOf<string>();
        }

        if (ctx.flags.json) {
          expectTypeOf(ctx.flags.yaml).toEqualTypeOf<false>();
        }

        expectTypeOf(ctx.state.client.ping()).toEqualTypeOf<boolean>();
        expectTypeOf(ctx.state.db.url).toEqualTypeOf<string>();
        expectTypeOf(ctx.state.requestId).toEqualTypeOf<string | undefined>();

        // @ts-expect-error non-existent state key must fail at compile time
        void ctx.state.nonExistentKey;
      },
    });

    const edit = command("edit <id>", {
      use: [hubAuth],
      flags: group(
        "Monitor Fields",
        atLeastOne({
          name: String,
          statusMin: Types.Integer({ min: 100, max: 599 }),
          statusMax: Types.Integer({ min: 100, max: 599 }),
        }),
      ),
      check({ args, flags }) {
        expectTypeOf(args.id).toEqualTypeOf<string>();
        expectTypeOf(flags.statusMin).toEqualTypeOf<number | undefined>();
        expectTypeOf(flags.statusMax).toEqualTypeOf<number | undefined>();

        return undefined;
      },
      run() {},
    });

    // Compile-time mutual exclusion of run and default
    command("node", {
      commands: [deploy, edit],
      // @ts-expect-error cannot pass both default and run on command()
      default: deploy,
      run() {},
    });

    const app = cli({
      name: "uptarn",
      version: "1.0.0",
      commands: [group("Admin", use([hubAuth], [deploy, edit]))],
    });
    expectTypeOf(app.run).toBeFunction();
    expectTypeOf(app.runMain).toBeFunction();
    expectTypeOf(app.buildModel).toBeFunction();
  });

  it("infers Standard Schema v1 output, arg defaults, implicitValue flags, and built-in context helpers", () => {
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

    command("sync [region] [files...]", {
      args: {
        region: { type: String, default: "us-east-1" },
        files: { type: String, default: ["index.ts"] },
      },
      flags: {
        at: { type: typesOnlySchema, required: true },
        retries: { type: validateOnlySchema, required: true },
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
        expectTypeOf(ctx.flags.at).toEqualTypeOf<Date>();
        expectTypeOf(ctx.flags.retries).toEqualTypeOf<number>();
        expectTypeOf(ctx.flags.inspect).toEqualTypeOf<number | undefined>();
        expectTypeOf(ctx.flags.color).toEqualTypeOf<
          "auto" | "always" | "never"
        >();
        expectTypeOf(ctx.flags.tags).toEqualTypeOf<string[]>();
        expectTypeOf(ctx.flags.port).toEqualTypeOf<number>();
        expectTypeOf(ctx.flags.cache).toEqualTypeOf<boolean>();
        expectTypeOf(ctx.flags.modes).toEqualTypeOf<("fast" | "safe")[]>();
        expectTypeOf(ctx.flags.verbose).toEqualTypeOf<number>();
        expectTypeOf(ctx.help.render).toBeFunction();
        expectTypeOf(ctx.help.print).toBeFunction();
        expectTypeOf(ctx.log).toEqualTypeOf<Logger>();
        expectTypeOf(ctx.raw.argv).toEqualTypeOf<readonly string[]>();
        expectTypeOf(ctx.raw.doubleDash).toEqualTypeOf<readonly string[]>();
        expectTypeOf(ctx.exit).toEqualTypeOf<(code?: number) => never>();
        expectTypeOf<
          ExtractArgNames<"exec <cmd> -- [args...]">
        >().toEqualTypeOf<"cmd" | "args">();
      },
    });

    expectTypeOf<
      CommandContext<{ id: string }, { json: boolean }, { user: string }>
    >().toMatchTypeOf<MiddlewareContext<{ json: boolean }, { user: string }>>();
    expectTypeOf<
      MiddlewareContext<{ json: boolean }, { user: string }>
    >().toMatchTypeOf<CliContext<{ json: boolean }, { user: string }>>();
    const checkFn: CheckFn<{ id: string }, { min?: number }> = ({ args }) =>
      args.id ? undefined : "missing id";
    const mwOpts: MiddlewareOptions = {};
    void checkFn;
    void mwOpts;
    void new ConstraintError("constraint violation");
    void new ClercError("domain failure");
    void new ClercError("auth failure", { code: "ERR_AUTH" });
  });
});
