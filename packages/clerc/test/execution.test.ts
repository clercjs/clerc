import { createMemoryTerminal, createTestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import {
  ClercError,
  ConstraintError,
  InvalidSchemaError,
  MissingFlagValueError,
  MissingRequiredArgumentError,
  MissingRequiredFlagError,
  NoCommandError,
  Types,
  UnexpectedArgumentError,
  UnknownCommandError,
  UnknownFlagError,
  ValidationError,
  command,
  exclusive,
  middleware,
  together,
} from "../src";

describe("Clerc execution pipeline", () => {
  it("supports route-style args, variadic, double-dash, and flags", async () => {
    let result: any;
    const terminal = createMemoryTerminal();

    const app = createTestBaseCli({
      commands: [
        command("copy <src> [dest] -- [extra...]", {
          flags: {
            force: { type: Boolean, short: "f" },
            retries: { type: Number, short: "r", default: 3 },
          },
          run(ctx) {
            result = { args: ctx.args, flags: ctx.flags };
          },
        }),
      ],
    });

    await app.run(
      ["copy", "a.txt", "b.txt", "-f", "--retries", "5", "--", "x", "y"],
      { terminal },
    );

    expect(result).toEqual({
      args: { src: "a.txt", dest: "b.txt", extra: ["x", "y"] },
      flags: { force: true, retries: 5 },
    });
  });

  it("respects --no-<flag> negation when boolean flag defaults to true", async () => {
    let captured: boolean | undefined;
    const terminal = createMemoryTerminal();

    const app = createTestBaseCli({
      commands: [
        command("build", {
          flags: { cache: { type: Boolean, default: true } },
          run(ctx) {
            captured = ctx.flags.cache;
          },
        }),
      ],
    });

    await app.run(["build"], { terminal });

    expect(captured).toBeTruthy();

    await app.run(["build", "--no-cache"], { terminal });

    expect(captured).toBeFalsy();
  });

  it("validates Number arguments with ValidationError on NaN", async () => {
    const terminal = createMemoryTerminal();
    const app = createTestBaseCli({
      commands: [
        command("wait <seconds>", {
          args: { seconds: Number },
          run() {},
        }),
      ],
    });

    await expect(
      app.run(["wait", "abc"], { terminal, throwOnError: true }),
    ).rejects.toThrow(ValidationError);
  });

  it("resolves env fallbacks for flags and skips missing required error when env is set", async () => {
    let captured: any;
    const terminal = createMemoryTerminal({
      env: { API_TOKEN: "secret-123", PORT: "4000", ENABLE_CACHE: "true" },
    });

    const app = createTestBaseCli({
      commands: [
        command("serve", {
          flags: {
            token: { type: String, required: true, env: "API_TOKEN" },
            port: { type: Number, env: "PORT", default: 3000 },
            cache: { type: Boolean, env: "ENABLE_CACHE" },
          },
          run(ctx) {
            captured = ctx.flags;
          },
        }),
      ],
    });

    await app.run(["serve"], { terminal });

    expect(captured).toEqual({
      token: "secret-123",
      port: 4000,
      cache: true,
    });
  });

  it("enforces required flags, declarative flag combinators, custom check (args + flags), and validates Number", async () => {
    const terminal = createMemoryTerminal();
    let middlewareRan = false;

    const app = createTestBaseCli({
      help: true,
      flags: exclusive({ json: Boolean }, { yaml: Boolean }),
      use: [
        middleware(async (_ctx, next) => {
          middlewareRan = true;
          await next();
        }),
      ],
      commands: [
        command("deploy [env]", {
          flags: [
            {
              token: { type: String, required: true, env: "DEPLOY_TOKEN" },
              port: { type: Number },
              all: Boolean,
              sudo: Boolean,
            },
            together({
              tlsKey: { type: String, required: true },
              tlsCert: { type: String, required: true },
            }),
          ],
          check: [
            ({ provided }) => {
              const hasEnv = provided.args.has("env");
              const hasAll = provided.flags.has("all");
              if (hasEnv === hasAll) {
                return "exactly one of '[env]' or '--all' must be provided";
              }
            },
            ({ flags }) => {
              if (
                flags.port !== undefined &&
                flags.port < 1024 &&
                !flags.sudo
              ) {
                return "ports below 1024 require --sudo";
              }
            },
          ],
          run() {},
        }),
      ],
    });

    await expect(
      app.run(["deploy", "prod"], { terminal, throwOnError: true }),
    ).rejects.toThrow(MissingRequiredFlagError);

    await expect(
      app.run(["deploy", "prod", "--token", "ok", "--port", "not-a-num"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(ValidationError);

    // Global exclusive combinator: --json vs --yaml
    const conflictRes = await app.run(
      ["deploy", "prod", "--token", "ok", "--json", "--yaml"],
      { terminal },
    );

    expect(conflictRes.ok).toBeFalsy();
    expect(conflictRes.error).toBeInstanceOf(ConstraintError);
    expect((conflictRes.error as ConstraintError).code).toBe("ERR_CONSTRAINT");

    // Cross arg + flag check: missing both & providing both
    await expect(
      app.run(["deploy", "--token", "ok"], { terminal, throwOnError: true }),
    ).rejects.toThrow(ConstraintError);

    await expect(
      app.run(["deploy", "prod", "--all", "--token", "ok"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(ConstraintError);

    // Together combinator: partial pair fails, omitting both succeeds!
    await expect(
      app.run(["deploy", "prod", "--token", "ok", "--tls-key", "k.pem"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(ConstraintError);

    // Custom check runs BEFORE middleware and attaches usage on failure
    const customFailTerm = createMemoryTerminal();
    const customFail = await app.run(
      ["deploy", "prod", "--token", "ok", "--port", "80"],
      { terminal: customFailTerm },
    );

    expect(customFail.ok).toBeFalsy();
    expect(customFail.exitCode).toBe(2);
    expect(middlewareRan).toBeFalsy();
    expect(customFailTerm.stderrText()).toContain(
      "ports below 1024 require --sudo",
    );
    expect(customFailTerm.stderrText()).toContain(
      "usage test deploy [options] [env]",
    );

    // Help renders inline constraint tags on options and never runs checks
    const helpTerm = createMemoryTerminal();
    const helpRes = await app.run(["deploy", "--help"], { terminal: helpTerm });

    expect(helpRes.ok).toBeTruthy();
    expect(helpTerm.stdoutText()).toContain("[conflicts: --yaml]");
    expect(helpTerm.stdoutText()).toContain("[with: --tls-cert]");

    // Valid invocation passes all checks and reaches middleware
    const okRes = await app.run(
      [
        "deploy",
        "--all",
        "--token",
        "ok",
        "--tls-key",
        "k.pem",
        "--tls-cert",
        "c.pem",
        "--port",
        "80",
        "--sudo",
      ],
      { terminal },
    );

    expect(okRes.ok).toBeTruthy();
    expect(middlewareRan).toBeTruthy();

    // Invalid constraint (e.g. single flag in together) fails upfront during buildModel()
    const invalidConstraintCli = createTestBaseCli({
      commands: [
        command("deploy", {
          flags: together({ onlyOne: String }),
          run() {},
        }),
      ],
    });

    expect(() => invalidConstraintCli.buildModel()).toThrow(InvalidSchemaError);
  });

  it("supports async handlers including dynamic lazy loading", async () => {
    let ran = false;
    const terminal = createMemoryTerminal();
    const loadHeavy = async () => ({
      default: async (ctx: { terminal: { stdout: (msg: string) => void } }) => {
        ran = true;
        ctx.terminal.stdout("loaded");
      },
    });

    const app = createTestBaseCli({
      commands: [
        command("heavy", {
          async run(ctx) {
            const mod = await loadHeavy();
            await mod.default(ctx);
          },
        }),
      ],
    });

    const res = await app.run(["heavy"], { terminal });

    expect(res.ok).toBeTruthy();
    expect(ran).toBeTruthy();
    expect(terminal.stdoutText()).toContain("loaded");
  });

  it("emits deprecation warnings for deprecated commands and flags", async () => {
    const terminal = createMemoryTerminal();

    const app = createTestBaseCli({
      commands: [
        command("old", {
          deprecated: "use new instead",
          flags: { legacy: { type: Boolean, deprecated: true } },
          run() {},
        }),
      ],
    });

    await app.run(["old", "--legacy"], { terminal });

    expect(terminal.stderrText()).toContain(
      "Command 'old' is deprecated: use new instead",
    );
    expect(terminal.stderrText()).toContain("Option '--legacy' is deprecated");

    terminal.clear();
    const rootCli = createTestBaseCli({
      name: "legacy-cli",
      deprecated: "use modern-cli instead",
      run() {},
    });
    await rootCli.run([], { terminal });

    expect(terminal.stderrText()).toContain(
      "Command 'legacy-cli' is deprecated: use modern-cli instead",
    );
  });

  it("runs onion middleware in order and is purely re-entrant", async () => {
    const events: string[] = [];
    const terminal = createMemoryTerminal();

    const app = createTestBaseCli({
      use: [
        middleware(async (ctx, next) => {
          events.push(`before:${ctx.calledAs}`);
          await next();
          events.push(`after:${ctx.calledAs}`);
        }),
      ],
      commands: [
        command("a", {
          run() {
            events.push("run:a");
          },
        }),
        command("b", {
          run() {
            events.push("run:b");
          },
        }),
      ],
    });

    await app.run(["a"], { terminal });
    await app.run(["b"], { terminal });

    expect(events).toEqual([
      "before:a",
      "run:a",
      "after:a",
      "before:b",
      "run:b",
      "after:b",
    ]);
  });

  it("throws NoCommandError, UnknownCommandError, and MissingRequiredArgumentError when throwOnError is true", async () => {
    const terminal = createMemoryTerminal();
    const app = createTestBaseCli({
      commands: [command("greet <name>", { run() {} })],
    });

    await expect(app.run([], { terminal, throwOnError: true })).rejects.toThrow(
      NoCommandError,
    );
    await expect(
      app.run(["nope"], { terminal, throwOnError: true }),
    ).rejects.toThrow(UnknownCommandError);
    await expect(
      app.run(["greet"], { terminal, throwOnError: true }),
    ).rejects.toThrow(MissingRequiredArgumentError);
  });

  it("rejects missing flag values, invalid boolean literals, root unknown flags, and unexpected arguments", async () => {
    const terminal = createMemoryTerminal();
    const app = createTestBaseCli({
      flags: {
        config: { type: String, short: "c" },
        verbose: { type: Types.Counter, short: "v" },
      },
      commands: [
        command("deploy <env>", {
          flags: {
            dryRun: { type: Boolean, short: "n" },
            port: { type: Number, short: "p" },
          },
          run() {},
        }),
      ],
    });

    await expect(
      app.run(["deploy", "prod", "-c", "-n"], { terminal, throwOnError: true }),
    ).rejects.toThrow(MissingFlagValueError);
    await expect(
      app.run(["deploy", "prod", "-c", "--", "rest"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(MissingFlagValueError);

    await expect(
      app.run(["deploy", "prod", "--dry-run=banana"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      app.run(["deploy", "prod", "extra"], { terminal, throwOnError: true }),
    ).rejects.toThrow(UnexpectedArgumentError);

    const okRes = await app.run(["deploy", "--verbose", "prod", "-p=8080"], {
      terminal,
    });

    expect(okRes.ok).toBeTruthy();

    const rootCli = createTestBaseCli({
      help: true,
      flags: { config: { type: String, short: "c" } },
      commands: [command("deploy", { run() {} })],
    });

    await expect(
      rootCli.run(["--conifg", "x"], { terminal, throwOnError: true }),
    ).rejects.toThrow(UnknownFlagError);
  });

  it("supports stopParsing presets and stateless predicates for wrapper commands", async () => {
    const runs: any[] = [];
    const terminal = createMemoryTerminal();
    const app = createTestBaseCli({
      commands: [
        command("exec <cmd> [args...]", {
          stopParsing: "first-positional",
          flags: { quiet: { type: Boolean, short: "q" } },
          run(ctx) {
            runs.push({ cmd: "exec", quiet: ctx.flags.quiet, args: ctx.args });
          },
        }),
        command("dev [args...]", {
          stopParsing: "unknown-flag",
          flags: { config: String },
          run(ctx) {
            runs.push({ cmd: "dev", config: ctx.flags.config, args: ctx.args });
          },
        }),
        command("run <env> <script> [args...]", {
          stopParsing: (token) =>
            token.kind === "positional" && token.positionalCount === 1,
          flags: { verbose: Boolean },
          run(ctx) {
            runs.push({
              cmd: "run",
              verbose: ctx.flags.verbose,
              args: ctx.args,
            });
          },
        }),
      ],
    });

    await app.run(["exec", "-q", "git", "--status", "-s"], { terminal });
    await app.run(["dev", "--config", "a.ts", "--port", "3000", "--open"], {
      terminal,
    });
    await app.run(["run", "prod", "--verbose", "app.ts", "--port", "3000"], {
      terminal,
    });
    await app.run(["run", "dev", "index.ts", "--watch"], { terminal });

    expect(runs).toEqual([
      {
        cmd: "exec",
        quiet: true,
        args: { cmd: "git", args: ["--status", "-s"] },
      },
      {
        cmd: "dev",
        config: "a.ts",
        args: { args: ["--port", "3000", "--open"] },
      },
      {
        cmd: "run",
        verbose: true,
        args: { env: "prod", script: "app.ts", args: ["--port", "3000"] },
      },
      {
        cmd: "run",
        verbose: false,
        args: { env: "dev", script: "index.ts", args: ["--watch"] },
      },
    ]);
  });

  it("supports flag aliases, array delimiter, optional-value implicitValue, arg default/env, and dash-value hints", async () => {
    let captured: any;
    const terminal = createMemoryTerminal({
      env: { DEPLOY_TOKEN: "env-tok", DEPLOY_TAGS: "a;b" },
    });

    const app = createTestBaseCli({
      help: true,
      commands: [
        command("deploy <token> [region] [files...]", {
          args: {
            token: { description: "Auth token", env: "DEPLOY_TOKEN" },
            region: { description: "Target region", default: "us-east-1" },
            files: { description: "Entry files", default: () => ["index.ts"] },
          },
          flags: {
            output: { type: String, short: "o", aliases: ["out", "outFile"] },
            tags: {
              type: String,
              multiple: true,
              delimiter: ",",
              env: "DEPLOY_TAGS",
            },
            nums: { type: Number, multiple: true, delimiter: "," },
            inspect: { type: Number, short: "I", implicitValue: 9229 },
            color: {
              type: String,
              default: "auto",
              implicitValue: "always",
            },
            pattern: { type: String },
          },
          run(ctx) {
            captured = { args: ctx.args, flags: ctx.flags };
          },
        }),
      ],
    });

    await app.run(
      [
        "deploy",
        "--out-file",
        "bundle.js",
        "--tags",
        "v1,v2",
        "--tags=v3",
        "--nums=1,2,3",
        "--inspect",
        "--color",
      ],
      { terminal },
    );

    expect(captured).toEqual({
      args: { token: "env-tok", region: "us-east-1", files: ["index.ts"] },
      flags: {
        output: "bundle.js",
        tags: ["v1", "v2", "v3"],
        nums: [1, 2, 3],
        inspect: 9229,
        color: "always",
        pattern: undefined,
      },
    });

    await app.run(
      [
        "deploy",
        "cli-tok",
        "eu-west-1",
        "a.ts",
        "--inspect=9230",
        "--color=never",
      ],
      { terminal },
    );

    expect(captured).toEqual({
      args: { token: "cli-tok", region: "eu-west-1", files: ["a.ts"] },
      flags: {
        output: undefined,
        tags: ["a;b"],
        nums: [],
        inspect: 9230,
        color: "never",
        pattern: undefined,
      },
    });

    const dashValRes = await app.run(["deploy", "tok", "--pattern", "-foo"], {
      terminal,
    });

    expect(dashValRes.ok).toBeFalsy();
    expect(dashValRes.error).toBeInstanceOf(MissingFlagValueError);
    expect((dashValRes.error as MissingFlagValueError).hints).toEqual([
      "if '-foo' is intended as the value, pass it as '--pattern=-foo'",
    ]);

    const helpTerm = createMemoryTerminal();
    await app.run(["deploy", "--help"], { terminal: helpTerm });
    const helpText = helpTerm.stdoutText();

    expect(helpText).toContain("-o, --output, --out, --out-file");
    expect(helpText).toContain("-I, --inspect[=<number>]");
    expect(helpText).toContain("[default: us-east-1]");
    expect(helpText).toContain("[env: DEPLOY_TOKEN]");

    const badDelimiterCli = createTestBaseCli({
      commands: [
        command("bad", {
          flags: { port: { type: String, delimiter: "," } },
          run() {},
        }),
      ],
    });

    await expect(
      badDelimiterCli.run(["bad"], { terminal, throwOnError: true }),
    ).rejects.toThrow(InvalidSchemaError);

    const badImplicitCli = createTestBaseCli({
      commands: [
        command("bad", {
          flags: { flag: { type: Boolean, implicitValue: true } },
          run() {},
        }),
      ],
    });

    await expect(
      badImplicitCli.run(["bad"], { terminal, throwOnError: true }),
    ).rejects.toThrow(InvalidSchemaError);

    const badArgDefaultCli = createTestBaseCli({
      commands: [
        command("bad <req>", {
          args: { req: { default: "x" } },
          run() {},
        }),
      ],
    });

    await expect(
      badArgDefaultCli.run(["bad"], { terminal, throwOnError: true }),
    ).rejects.toThrow(InvalidSchemaError);

    const unknownArgKeyCli = createTestBaseCli({
      commands: [
        command("bad <entry>", {
          args: { typo: String } as any,
          run() {},
        }),
      ],
    });

    expect(() => unknownArgKeyCli.buildModel()).toThrow(InvalidSchemaError);

    const zeroArgUnknownKeyCli = createTestBaseCli({
      commands: [
        command("bad", {
          args: { typo: String } as any,
          run() {},
        }),
      ],
    });

    expect(() => zeroArgUnknownKeyCli.buildModel()).toThrow(InvalidSchemaError);

    const dupDdArgCli = createTestBaseCli({
      commands: [command("bad <x> -- <x>", { run() {} })],
    });

    expect(() => dupDdArgCli.buildModel()).toThrow(InvalidSchemaError);

    let seenDefaultTags: string[] = [];
    const arrayDefaultCli = createTestBaseCli({
      commands: [
        command("tag", {
          flags: {
            tags: { type: String, multiple: true, default: ["latest"] },
          },
          run(ctx) {
            ctx.flags.tags.push("mutated");
            seenDefaultTags = ctx.flags.tags;
          },
        }),
      ],
    });
    await arrayDefaultCli.run(["tag"], { terminal });
    await arrayDefaultCli.run(["tag"], { terminal });

    expect(seenDefaultTags).toEqual(["latest", "mutated"]);

    const aliasTypoRes = await app.run(
      ["deploy", "tok", "--out-flie", "a.js"],
      { terminal },
    );

    expect(aliasTypoRes.ok).toBeFalsy();
    expect((aliasTypoRes.error as UnknownFlagError).hints).toContain(
      "a similar option exists: '--out-file'",
    );
  });

  it("validates counter env, keeps ctx.flags clean on parse error, compiles subcommands upfront, and avoids -h collision", async () => {
    const badEnvTerm = createMemoryTerminal({ env: { VERBOSE: "banana" } });
    const envCli = createTestBaseCli({
      commands: [
        command("ping", {
          flags: { verbose: { type: Types.Counter, env: "VERBOSE" } },
          run() {},
        }),
      ],
    });

    await expect(
      envCli.run(["ping"], { terminal: badEnvTerm, throwOnError: true }),
    ).rejects.toThrow(ValidationError);

    let errorFlags: Record<string, unknown> | undefined;
    const errCli = createTestBaseCli({
      onError(_err, ctx) {
        errorFlags = { ...ctx.flags };

        return true;
      },
      commands: [
        command("serve <entry>", {
          flags: {
            port: { type: Number },
            inspect: { type: Number, implicitValue: 9229 },
          },
          run() {},
        }),
      ],
    });

    await errCli.run(["serve", "--port", "8080", "--inspect", "--unknown"], {
      terminal: createMemoryTerminal(),
    });

    expect(errorFlags).toEqual({});

    await errCli.run(["serve", "--port", "8080", "--inspect"], {
      terminal: createMemoryTerminal(),
    });

    expect(errorFlags).toEqual({ port: 8080, inspect: 9229 });

    const brokenSubCli = createTestBaseCli({
      commands: [
        command("ok", { run() {} }),
        command("unused", {
          flags: { bad: { type: String, delimiter: "," } },
          run() {},
        }),
      ],
    });

    expect(() => brokenSubCli.buildModel()).toThrow(InvalidSchemaError);

    let hostObserved: string | undefined;
    const hostTerm = createMemoryTerminal();
    const hostCli = createTestBaseCli({
      help: true,
      commands: [
        command("connect", {
          flags: { host: { type: String, short: "h", description: "DB host" } },
          run(ctx) {
            hostObserved = ctx.flags.host;
          },
        }),
      ],
    });

    await hostCli.run(["connect", "-h", "db.local"], { terminal: hostTerm });

    expect(hostObserved).toBe("db.local");

    await hostCli.run(["connect", "--help"], { terminal: hostTerm });

    expect(hostTerm.stdoutText()).toContain("-h, --host <string>");
    expect(hostTerm.stdoutText()).toContain("    --help");

    let rawSnapshot:
      | {
          readonly argv: readonly string[];
          readonly unknown: Record<string, unknown>;
          readonly doubleDash: readonly string[];
        }
      | undefined;
    const rawCli = createTestBaseCli({
      strictFlags: false,
      commands: [
        command("run <script> --", {
          run(ctx) {
            rawSnapshot = {
              argv: ctx.raw.argv,
              unknown: ctx.raw.unknown,
              doubleDash: ctx.raw.doubleDash,
            };
          },
        }),
      ],
    });

    const rawRes = await rawCli.run(
      ["run", "test", "--extra=1", "--", "--watch", "--bail"],
      { terminal: createMemoryTerminal() },
    );

    expect(rawRes.ok).toBeTruthy();
    expect(rawSnapshot).toEqual({
      argv: ["run", "test", "--extra=1", "--", "--watch", "--bail"],
      unknown: { extra: "1" },
      doubleDash: ["--watch", "--bail"],
    });
  });

  it("supports domain ClercError defaults, controlled ctx.exit(), and terminal stdin", async () => {
    const events: string[] = [];
    const terminal = createMemoryTerminal({ stdin: "hello from pipe\n" });

    const app = createTestBaseCli({
      help: true,
      use: [
        middleware(async (ctx, next) => {
          try {
            await next();
          } finally {
            events.push(`finally:${ctx.calledAs}`);
          }
        }),
      ],
      onError(err, ctx) {
        events.push(`onError:${(err as Error).message}`);
        if (err instanceof Error && err.message === "override-exit") {
          ctx.exit(4);
        }
      },
      commands: [
        command("auth", {
          run() {
            throw new ClercError("not logged in", {
              code: "ERR_AUTH",
              detail: "Run login first",
            });
          },
        }),
        command("simple-fail", {
          run() {
            throw new ClercError("deployment aborted");
          },
        }),
        command("check", {
          flags: { ok: Boolean },
          run(ctx) {
            if (ctx.flags.ok) {
              ctx.exit(0);
            }
            ctx.log.warn("formatting differs");
            ctx.exit(3);
          },
        }),
        command("override", {
          run() {
            throw new Error("override-exit");
          },
        }),
        command("pipe", {
          async run(ctx) {
            const input = await ctx.terminal.readStdin();
            ctx.terminal.stdout(
              `tty=${String(ctx.terminal.isInputTTY)}:${input.trim()}`,
            );
          },
        }),
      ],
    });

    const authRes = await app.run(["auth"], { terminal });

    expect(authRes.ok).toBeFalsy();
    expect(authRes.exitCode).toBe(1);
    expect((authRes.error as ClercError).code).toBe("ERR_AUTH");
    expect(terminal.stderrText()).toContain("error not logged in");
    expect(terminal.stderrText()).not.toContain("--help");

    terminal.clear();
    const simpleRes = await app.run(["simple-fail"], { terminal });

    expect(simpleRes.ok).toBeFalsy();
    expect(simpleRes.exitCode).toBe(1);
    expect((simpleRes.error as ClercError).code).toBe("ERR_CLI");
    expect(terminal.stderrText()).toBe("error deployment aborted");

    events.length = 0;
    terminal.clear();
    const exitRes = await app.run(["check"], {
      terminal,
      throwOnError: true,
    });

    expect(exitRes).toEqual({ ok: false, exitCode: 3 });
    expect(events).toEqual(["finally:check"]);
    expect(terminal.stderrText()).toBe(" warn formatting differs");

    events.length = 0;
    const zeroRes = await app.run(["check", "--ok"], {
      terminal,
      throwOnError: true,
    });

    expect(zeroRes).toEqual({ ok: true, exitCode: 0 });
    expect(events).toEqual(["finally:check"]);

    events.length = 0;
    terminal.clear();
    const overrideRes = await app.run(["override"], {
      terminal,
      throwOnError: true,
    });

    expect(overrideRes).toEqual({ ok: false, exitCode: 4 });
    expect(events).toEqual(["finally:override", "onError:override-exit"]);
    expect(terminal.stderrText()).toBe("");

    terminal.clear();
    const pipeRes = await app.run(["pipe"], { terminal });

    expect(pipeRes.ok).toBeTruthy();
    expect(terminal.stdoutText()).toBe("tty=false:hello from pipe");

    const ttyTerm = createMemoryTerminal();

    expect(ttyTerm.isInputTTY).toBeTruthy();
    await expect(ttyTerm.readStdin()).resolves.toBe("");
  });
});
