import { createMemoryTerminal, createTestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import {
  ClercError,
  InvalidSchemaError,
  MissingFlagValueError,
  MissingRequiredArgumentError,
  MissingRequiredFlagError,
  NoCommandError,
  RuleError,
  Types,
  UnexpectedArgumentError,
  UnknownCommandError,
  UnknownFlagError,
  ValidationError,
} from "../src";

describe("Clerc execution pipeline", () => {
  it("supports route-style args, variadic, double-dash, and flags", async () => {
    let result: any;
    const terminal = createMemoryTerminal();

    const cli = createTestBaseCli();
    cli.command("copy <src> [dest] -- [extra...]", {
      flags: {
        force: { type: Boolean, short: "f" },
        retries: { type: Number, short: "r", default: 3 },
      },
      run(ctx) {
        result = { args: ctx.args, flags: ctx.flags };
      },
    });

    await cli.run(
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

    const cli = createTestBaseCli();
    cli.command("build", {
      flags: { cache: { type: Boolean, default: true } },
      run(ctx) {
        captured = ctx.flags.cache;
      },
    });

    await cli.run(["build"], { terminal });

    expect(captured).toBeTruthy();

    await cli.run(["build", "--no-cache"], { terminal });

    expect(captured).toBeFalsy();
  });

  it("validates Number arguments with ValidationError on NaN", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestBaseCli();
    cli.command("wait <seconds>", {
      args: { seconds: Number },
      run() {},
    });

    await expect(
      cli.run(["wait", "abc"], { terminal, throwOnError: true }),
    ).rejects.toThrow(ValidationError);
  });

  it("resolves env fallbacks for flags and skips missing required error when env is set", async () => {
    let captured: any;
    const terminal = createMemoryTerminal({
      env: { API_TOKEN: "secret-123", PORT: "4000", ENABLE_CACHE: "true" },
    });

    const cli = createTestBaseCli();
    cli.command("serve", {
      flags: {
        token: { type: String, required: true, env: "API_TOKEN" },
        port: { type: Number, env: "PORT", default: 3000 },
        cache: { type: Boolean, env: "ENABLE_CACHE" },
      },
      run(ctx) {
        captured = ctx.flags;
      },
    });

    await cli.run(["serve"], { terminal });

    expect(captured).toEqual({
      token: "secret-123",
      port: 4000,
      cache: true,
    });
  });

  it("enforces required flags, declarative & custom rules (args + flags), and validates Number", async () => {
    const terminal = createMemoryTerminal();
    let middlewareRan = false;
    const cli = createTestBaseCli({ help: true })
      .flags({
        json: Boolean,
        yaml: Boolean,
      })
      .rules(({ exclusive, flag }) => [exclusive(flag("json"), flag("yaml"))])
      .middleware(async (_ctx, next) => {
        middlewareRan = true;
        await next();
      });

    cli.command("deploy [env]", {
      flags: {
        token: { type: String, required: true, env: "DEPLOY_TOKEN" },
        port: { type: Number },
        all: Boolean,
        tlsKey: String,
        tlsCert: String,
        sudo: Boolean,
      },
      rules: ({ oneOf, together, flag, arg }) => [
        oneOf(arg("env"), flag("all")),
        together(flag("tlsKey"), flag("tlsCert")),
        ({ flags }) => {
          if (flags.port !== undefined && flags.port < 1024 && !flags.sudo) {
            return "ports below 1024 require --sudo";
          }
        },
      ],
      run() {},
    });

    await expect(
      cli.run(["deploy", "prod"], { terminal, throwOnError: true }),
    ).rejects.toThrow(MissingRequiredFlagError);

    await expect(
      cli.run(["deploy", "prod", "--token", "ok", "--port", "not-a-num"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(ValidationError);

    // Global exclusive rule: --json vs --yaml (uniform ERR_RULE_VIOLATION code)
    const conflictRes = await cli.run(
      ["deploy", "prod", "--token", "ok", "--json", "--yaml"],
      { terminal },
    );

    expect(conflictRes.ok).toBeFalsy();
    expect(conflictRes.error).toBeInstanceOf(RuleError);
    expect((conflictRes.error as RuleError).code).toBe("ERR_RULE_VIOLATION");

    // Mixed arg + flag oneOf rule: missing both & providing both
    await expect(
      cli.run(["deploy", "--token", "ok"], { terminal, throwOnError: true }),
    ).rejects.toThrow(RuleError);

    await expect(
      cli.run(["deploy", "prod", "--all", "--token", "ok"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(RuleError);

    // Together rule: partial pair fails
    await expect(
      cli.run(["deploy", "prod", "--token", "ok", "--tls-key", "k.pem"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(RuleError);

    // Custom rule runs BEFORE middleware and attaches usage on failure
    const customFailTerm = createMemoryTerminal();
    const customFail = await cli.run(
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

    // Help renders inline constraint tags on options/args and never runs rules
    const helpTerm = createMemoryTerminal();
    const helpRes = await cli.run(["deploy", "--help"], { terminal: helpTerm });

    expect(helpRes.ok).toBeTruthy();
    expect(helpTerm.stdoutText()).not.toContain("CONSTRAINTS");
    expect(helpTerm.stdoutText()).toContain("[conflicts: --yaml]");
    expect(helpTerm.stdoutText()).toContain("[one of: [env], --all]");
    expect(helpTerm.stdoutText()).toContain("[with: --tls-cert]");

    // Valid invocation passes all rules and reaches middleware
    const okRes = await cli.run(
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

    // Invalid rule reference fails upfront during buildModel()
    const invalidRuleCli = createTestBaseCli();
    invalidRuleCli.command("deploy", {
      flags: { json: Boolean },
      rules: ({ exclusive, flag }) => [
        exclusive(flag("json"), flag("nonExistent" as never)),
      ],
      run() {},
    });

    expect(() => invalidRuleCli.buildModel()).toThrow(InvalidSchemaError);
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

    const cli = createTestBaseCli();
    cli.command("heavy", {
      async run(ctx) {
        const mod = await loadHeavy();
        await mod.default(ctx);
      },
    });

    const res = await cli.run(["heavy"], { terminal });

    expect(res.ok).toBeTruthy();
    expect(ran).toBeTruthy();
    expect(terminal.stdoutText()).toContain("loaded");
  });

  it("emits deprecation warnings for deprecated commands and flags", async () => {
    const terminal = createMemoryTerminal();

    const cli = createTestBaseCli();
    cli.command("old", {
      deprecated: "use new instead",
      flags: { legacy: { type: Boolean, deprecated: true } },
      run() {},
    });

    await cli.run(["old", "--legacy"], { terminal });

    expect(terminal.stderrText()).toContain(
      "Command 'old' is deprecated: use new instead",
    );
    expect(terminal.stderrText()).toContain("Option '--legacy' is deprecated");

    terminal.clear();
    const rootCli = createTestBaseCli({ name: "legacy-cli" }).command({
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

    const cli = createTestBaseCli().middleware(async (ctx, next) => {
      events.push(`before:${ctx.calledAs}`);
      await next();
      events.push(`after:${ctx.calledAs}`);
    });
    cli.command("a", {
      run() {
        events.push("run:a");
      },
    });
    cli.command("b", {
      run() {
        events.push("run:b");
      },
    });

    await cli.run(["a"], { terminal });
    await cli.run(["b"], { terminal });

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
    const cli = createTestBaseCli();
    cli.command("greet <name>", { run() {} });

    await expect(cli.run([], { terminal, throwOnError: true })).rejects.toThrow(
      NoCommandError,
    );
    await expect(
      cli.run(["nope"], { terminal, throwOnError: true }),
    ).rejects.toThrow(UnknownCommandError);
    await expect(
      cli.run(["greet"], { terminal, throwOnError: true }),
    ).rejects.toThrow(MissingRequiredArgumentError);
  });

  it("rejects missing flag values, invalid boolean literals, root unknown flags, and unexpected arguments", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestBaseCli().flags({
      config: { type: String, short: "c" },
      verbose: { type: Types.Counter, short: "v" },
    });
    cli.command("deploy <env>", {
      flags: {
        dryRun: { type: Boolean, short: "n" },
        port: { type: Number, short: "p" },
      },
      run() {},
    });

    // Missing value before next flag or --
    await expect(
      cli.run(["deploy", "prod", "-c", "-n"], { terminal, throwOnError: true }),
    ).rejects.toThrow(MissingFlagValueError);
    await expect(
      cli.run(["deploy", "prod", "-c", "--", "rest"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(MissingFlagValueError);

    // Invalid boolean literal
    await expect(
      cli.run(["deploy", "prod", "--dry-run=banana"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(ValidationError);

    // Extra positional argument rejected
    await expect(
      cli.run(["deploy", "prod", "extra"], { terminal, throwOnError: true }),
    ).rejects.toThrow(UnexpectedArgumentError);

    // Counter flag does not eat positional argument & -p=8080 works
    const okRes = await cli.run(["deploy", "--verbose", "prod", "-p=8080"], {
      terminal,
    });

    expect(okRes.ok).toBeTruthy();

    // Unknown root flag does not silently print help
    const rootCli = createTestBaseCli({ help: true }).flags({
      config: { type: String, short: "c" },
    });
    rootCli.command("deploy", { run() {} });

    await expect(
      rootCli.run(["--conifg", "x"], { terminal, throwOnError: true }),
    ).rejects.toThrow(UnknownFlagError);
  });

  it("supports stopParsing presets and stateless predicates for wrapper commands", async () => {
    const runs: any[] = [];
    const terminal = createMemoryTerminal();
    const cli = createTestBaseCli();
    cli
      .command("exec <cmd> [args...]", {
        stopParsing: "first-positional",
        flags: { quiet: { type: Boolean, short: "q" } },
        run(ctx) {
          runs.push({ cmd: "exec", quiet: ctx.flags.quiet, args: ctx.args });
        },
      })
      .command("dev [args...]", {
        stopParsing: "unknown-flag",
        flags: { config: String },
        run(ctx) {
          runs.push({ cmd: "dev", config: ctx.flags.config, args: ctx.args });
        },
      })
      .command("run <env> <script> [args...]", {
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
      });

    await cli.run(["exec", "-q", "git", "--status", "-s"], { terminal });
    await cli.run(["dev", "--config", "a.ts", "--port", "3000", "--open"], {
      terminal,
    });
    await cli.run(["run", "prod", "--verbose", "app.ts", "--port", "3000"], {
      terminal,
    });
    await cli.run(["run", "dev", "index.ts", "--watch"], { terminal });

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

    const cli = createTestBaseCli({ help: true });
    cli.command("deploy <token> [region] [files...]", {
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
    });

    // Aliases, delimiter, implicitValue (without =), arg env + default
    await cli.run(
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

    // Optional-value with explicit =value and unset implicitValue
    await cli.run(
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

    // MissingFlagValueError hint when next token looks like a flag
    const dashValRes = await cli.run(["deploy", "tok", "--pattern", "-foo"], {
      terminal,
    });

    expect(dashValRes.ok).toBeFalsy();
    expect(dashValRes.error).toBeInstanceOf(MissingFlagValueError);
    expect((dashValRes.error as MissingFlagValueError).hints).toEqual([
      "if '-foo' is intended as the value, pass it as '--pattern=-foo'",
    ]);

    // Help renders aliases, [=placeholder], and arg [default: ...] / [env: ...]
    const helpTerm = createMemoryTerminal();
    await cli.run(["deploy", "--help"], { terminal: helpTerm });
    const helpText = helpTerm.stdoutText();

    expect(helpText).toContain("-o, --output, --out, --out-file");
    expect(helpText).toContain("-I, --inspect[=<number>]");
    expect(helpText).toContain("[default: us-east-1]");
    expect(helpText).toContain("[env: DEPLOY_TOKEN]");

    // Schema validation guards
    const badDelimiterCli = createTestBaseCli();
    badDelimiterCli.command("bad", {
      flags: { port: { type: String, delimiter: "," } },
      run() {},
    });

    await expect(
      badDelimiterCli.run(["bad"], { terminal, throwOnError: true }),
    ).rejects.toThrow(InvalidSchemaError);

    const badImplicitCli = createTestBaseCli();
    badImplicitCli.command("bad", {
      flags: { flag: { type: Boolean, implicitValue: true } },
      run() {},
    });

    await expect(
      badImplicitCli.run(["bad"], { terminal, throwOnError: true }),
    ).rejects.toThrow(InvalidSchemaError);

    const badArgDefaultCli = createTestBaseCli();
    badArgDefaultCli.command("bad <req>", {
      args: { req: { default: "x" } },
      run() {},
    });

    await expect(
      badArgDefaultCli.run(["bad"], { terminal, throwOnError: true }),
    ).rejects.toThrow(InvalidSchemaError);

    const unknownArgKeyCli = createTestBaseCli();
    unknownArgKeyCli.command("bad <entry>", {
      args: { typo: String } as any,
      run() {},
    });

    expect(() => unknownArgKeyCli.buildModel()).toThrow(InvalidSchemaError);

    const zeroArgUnknownKeyCli = createTestBaseCli();
    zeroArgUnknownKeyCli.command("bad", {
      args: { typo: String } as any,
      run() {},
    });

    expect(() => zeroArgUnknownKeyCli.buildModel()).toThrow(InvalidSchemaError);

    const dupDdArgCli = createTestBaseCli();
    dupDdArgCli.command("bad <x> -- <x>", { run() {} });

    expect(() => dupDdArgCli.buildModel()).toThrow(InvalidSchemaError);

    // Array literal defaults are cloned per invocation
    let seenDefaultTags: string[] = [];
    const arrayDefaultCli = createTestBaseCli();
    arrayDefaultCli.command("tag", {
      flags: {
        tags: { type: String, multiple: true, default: ["latest"] },
      },
      run(ctx) {
        ctx.flags.tags.push("mutated");
        seenDefaultTags = ctx.flags.tags;
      },
    });
    await arrayDefaultCli.run(["tag"], { terminal });
    await arrayDefaultCli.run(["tag"], { terminal });

    expect(seenDefaultTags).toEqual(["latest", "mutated"]);

    // Kebab-case alias suggestion works accurately
    const aliasTypoRes = await cli.run(
      ["deploy", "tok", "--out-flie", "a.js"],
      { terminal },
    );

    expect(aliasTypoRes.ok).toBeFalsy();
    expect((aliasTypoRes.error as UnknownFlagError).hints).toContain(
      "a similar option exists: '--out-file'",
    );
  });

  it("validates counter env, keeps ctx.flags clean on parse error, compiles subcommands upfront, and avoids -h collision", async () => {
    // 1. Counter env rejects invalid values instead of silently becoming 0
    const badEnvTerm = createMemoryTerminal({ env: { VERBOSE: "banana" } });
    const envCli = createTestBaseCli();
    envCli.command("ping", {
      flags: { verbose: { type: Types.Counter, env: "VERBOSE" } },
      run() {},
    });

    await expect(
      envCli.run(["ping"], { terminal: badEnvTerm, throwOnError: true }),
    ).rejects.toThrow(ValidationError);

    // 2. Error handler never sees raw unconverted strings or internal IMPLICIT_FLAG_VALUE symbols
    let errorFlags: Record<string, unknown> | undefined;
    const errCli = createTestBaseCli().onError((_err, ctx) => {
      errorFlags = { ...ctx.flags };

      return true;
    });
    errCli.command("serve <entry>", {
      flags: {
        port: { type: Number },
        inspect: { type: Number, implicitValue: 9229 },
      },
      run() {},
    });

    // Parse error before flag resolution: ctx.flags stays empty (no raw strings or internal symbols)
    await errCli.run(["serve", "--port", "8080", "--inspect", "--unknown"], {
      terminal: createMemoryTerminal(),
    });

    expect(errorFlags).toEqual({});

    // Arg error after flag resolution: ctx.flags holds resolved typed values
    await errCli.run(["serve", "--port", "8080", "--inspect"], {
      terminal: createMemoryTerminal(),
    });

    expect(errorFlags).toEqual({ port: 8080, inspect: 9229 });

    // 3. Upfront compilation catches invalid schema in unused subcommands immediately
    const brokenSubCli = createTestBaseCli();
    brokenSubCli.command("ok", { run() {} });
    brokenSubCli.command("unused", {
      flags: { bad: { type: String, delimiter: "," } },
      run() {},
    });

    expect(() => brokenSubCli.buildModel()).toThrow(InvalidSchemaError);

    // 4. User short '-h' (e.g. --host) does not crash against built-in --help
    let hostObserved: string | undefined;
    const hostTerm = createMemoryTerminal();
    const hostCli = createTestBaseCli({ help: true });
    hostCli.command("connect", {
      flags: { host: { type: String, short: "h", description: "DB host" } },
      run(ctx) {
        hostObserved = ctx.flags.host;
      },
    });

    await hostCli.run(["connect", "-h", "db.local"], { terminal: hostTerm });

    expect(hostObserved).toBe("db.local");

    await hostCli.run(["connect", "--help"], { terminal: hostTerm });

    expect(hostTerm.stdoutText()).toContain("-h, --host <string>");
    expect(hostTerm.stdoutText()).toContain("    --help");

    // 5. Raw parse artifacts live under ctx.raw (argv, unknown, doubleDash)
    let rawSnapshot:
      | {
          readonly argv: readonly string[];
          readonly unknown: Record<string, unknown>;
          readonly doubleDash: readonly string[];
        }
      | undefined;
    const rawCli = createTestBaseCli({ strictFlags: false });
    rawCli.command("run <script> --", {
      run(ctx) {
        rawSnapshot = {
          argv: ctx.raw.argv,
          unknown: ctx.raw.unknown,
          doubleDash: ctx.raw.doubleDash,
        };
      },
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

    const cli = createTestBaseCli({ help: true })
      .middleware(async (ctx, next) => {
        try {
          await next();
        } finally {
          events.push(`finally:${ctx.calledAs}`);
        }
      })
      .onError((err, ctx) => {
        events.push(`onError:${(err as Error).message}`);
        if (err instanceof Error && err.message === "override-exit") {
          ctx.exit(4);
        }
      });

    cli.command("auth", {
      run() {
        throw new ClercError("not logged in", {
          code: "ERR_AUTH",
          detail: "Run login first",
        });
      },
    });
    cli.command("simple-fail", {
      run() {
        throw new ClercError("deployment aborted");
      },
    });
    cli.command("check", {
      flags: { ok: Boolean },
      run(ctx) {
        if (ctx.flags.ok) {
          ctx.exit(0);
        }
        ctx.log.warn("formatting differs");
        ctx.exit(3);
      },
    });
    cli.command("override", {
      run() {
        throw new Error("override-exit");
      },
    });
    cli.command("pipe", {
      async run(ctx) {
        const input = await ctx.terminal.readStdin();
        ctx.terminal.stdout(
          `tty=${String(ctx.terminal.isInputTTY)}:${input.trim()}`,
        );
      },
    });

    // Domain ClercError defaults to exitCode 1 and omits --help hint
    const authRes = await cli.run(["auth"], { terminal });

    expect(authRes.ok).toBeFalsy();
    expect(authRes.exitCode).toBe(1);
    expect((authRes.error as ClercError).code).toBe("ERR_AUTH");
    expect(terminal.stderrText()).toContain("error not logged in");
    expect(terminal.stderrText()).not.toContain("--help");

    // ClercError without options defaults to ERR_CLI and exitCode 1
    terminal.clear();
    const simpleRes = await cli.run(["simple-fail"], { terminal });

    expect(simpleRes.ok).toBeFalsy();
    expect(simpleRes.exitCode).toBe(1);
    expect((simpleRes.error as ClercError).code).toBe("ERR_CLI");
    expect(terminal.stderrText()).toBe("error deployment aborted");

    // ctx.exit(3) skips onError & throwOnError, still runs middleware finally
    events.length = 0;
    terminal.clear();
    const exitRes = await cli.run(["check"], {
      terminal,
      throwOnError: true,
    });

    expect(exitRes).toEqual({ ok: false, exitCode: 3 });
    expect(events).toEqual(["finally:check"]);
    expect(terminal.stderrText()).toBe(" warn formatting differs");

    // ctx.exit(0) exits cleanly as ok: true
    events.length = 0;
    const zeroRes = await cli.run(["check", "--ok"], {
      terminal,
      throwOnError: true,
    });

    expect(zeroRes).toEqual({ ok: true, exitCode: 0 });
    expect(events).toEqual(["finally:check"]);

    // ctx.exit() inside onError overrides exitCode cleanly
    events.length = 0;
    terminal.clear();
    const overrideRes = await cli.run(["override"], {
      terminal,
      throwOnError: true,
    });

    expect(overrideRes).toEqual({ ok: false, exitCode: 4 });
    expect(events).toEqual(["finally:override", "onError:override-exit"]);
    expect(terminal.stderrText()).toBe("");

    // terminal.readStdin() & isInputTTY
    terminal.clear();
    const pipeRes = await cli.run(["pipe"], { terminal });

    expect(pipeRes.ok).toBeTruthy();
    expect(terminal.stdoutText()).toBe("tty=false:hello from pipe");

    const ttyTerm = createMemoryTerminal();

    expect(ttyTerm.isInputTTY).toBeTruthy();
    await expect(ttyTerm.readStdin()).resolves.toBe("");
  });

  it("propagates RunOptions.signal and lazily attaches SIGINT/SIGTERM only when ctx.signal is read in runMain()", async () => {
    const terminal = createMemoryTerminal();
    const events: string[] = [];
    let notifyWaiting: (() => void) | undefined;

    const cli = createTestBaseCli().middleware(async (ctx, next) => {
      try {
        await next();
      } finally {
        events.push(`finally:${ctx.calledAs}`);
      }
    });

    cli.command("quick", {
      run() {
        events.push(`listeners:${process.listenerCount("SIGINT")}`);
      },
    });

    cli.command("check-signal", {
      run(ctx) {
        events.push(`hasSignal:${String(ctx.signal !== undefined)}`);
      },
    });

    cli.command("nested", {
      async run(ctx) {
        await ctx.run(["wait"], { terminal: ctx.terminal, throwOnError: true });
      },
    });

    cli.command("wait", {
      async run(ctx) {
        const firstSignal = ctx.signal;
        const sameRef = firstSignal === ctx.signal;
        events.push(`sameRef:${String(sameRef)}`);
        await new Promise<void>((_resolve, reject) => {
          if (firstSignal?.aborted) {
            reject(firstSignal.reason);

            return;
          }
          firstSignal?.addEventListener(
            "abort",
            () => reject(firstSignal.reason),
            { once: true },
          );
          notifyWaiting?.();
        });
      },
    });

    // 0. cli.run() without options.signal leaves ctx.signal undefined
    await cli.run(["check-signal"], { terminal });

    expect(events).toEqual(["hasSignal:false", "finally:check-signal"]);

    // 1. cli.run() propagates options.signal into nested ctx.run()
    events.length = 0;
    const controller = new AbortController();
    const waitReady = new Promise<void>((resolve) => {
      notifyWaiting = resolve;
    });
    const runPromise = cli.run(["nested"], {
      terminal,
      signal: controller.signal,
    });
    await waitReady;
    controller.abort(new Error("timed out"));
    const runRes = await runPromise;

    expect(runRes.ok).toBeFalsy();
    expect(runRes.exitCode).toBe(1);
    expect(events).toEqual(["sameRef:true", "finally:wait", "finally:nested"]);

    // 2. runMain() does NOT attach SIGINT listeners when command never accesses ctx.signal
    events.length = 0;
    const baselineSigInt = process.listenerCount("SIGINT");
    const savedExitCode = process.exitCode;
    try {
      await cli.runMain(["quick"], { terminal });

      expect(events).toEqual([`listeners:${baselineSigInt}`, "finally:quick"]);

      // 3. runMain() lazily attaches SIGINT when ctx.signal is read, aborts with 130, and detaches afterward
      events.length = 0;
      terminal.clear();
      const mainReady = new Promise<void>((resolve) => {
        notifyWaiting = resolve;
      });
      const mainPromise = cli.runMain(["wait"], { terminal });
      await mainReady;

      expect(process.listenerCount("SIGINT")).toBe(baselineSigInt + 1);

      process.emit("SIGINT");
      const mainRes = await mainPromise;

      expect(mainRes).toEqual({ ok: false, exitCode: 130 });
      expect(process.exitCode).toBe(130);
      expect(terminal.stderrText()).toBe("");
      expect(events).toEqual(["sameRef:true", "finally:wait"]);
      expect(process.listenerCount("SIGINT")).toBe(baselineSigInt);
    } finally {
      process.exitCode = savedExitCode;
    }
  });
});
