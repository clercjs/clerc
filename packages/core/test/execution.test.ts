import { createMemoryTerminal, createTestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import {
  FlagConflictError,
  FlagImpliesError,
  InvalidParametersError,
  InvalidSchemaError,
  MissingFlagValueError,
  MissingRequiredFlagError,
  MissingRequiredParameterError,
  NoCommandError,
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

  it("enforces required flags, conflicts, implies, and validates Number", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestBaseCli();
    cli.command("deploy", {
      flags: {
        token: { type: String, required: true, env: "DEPLOY_TOKEN" },
        port: { type: Number },
        json: { type: Boolean, conflicts: "yaml" },
        yaml: { type: Boolean },
        tlsKey: { type: String, implies: "tlsCert" },
        tlsCert: { type: String },
      },
      run() {},
    });

    await expect(
      cli.run(["deploy"], { terminal, throwOnError: true }),
    ).rejects.toThrow(MissingRequiredFlagError);

    await expect(
      cli.run(["deploy", "--token", "ok", "--port", "not-a-num"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      cli.run(["deploy", "--token", "ok", "--json", "--yaml"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(FlagConflictError);

    await expect(
      cli.run(["deploy", "--token", "ok", "--tls-key", "k.pem"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(FlagImpliesError);
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

  it("throws NoCommandError, UnknownCommandError, and MissingRequiredParameterError when throwOnError is true", async () => {
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
    ).rejects.toThrow(MissingRequiredParameterError);
  });

  it("rejects missing flag values, invalid boolean literals, root unknown flags, and unexpected arguments", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestBaseCli().flags({
      config: { type: String, short: "c" },
      verbose: { type: [Boolean], short: "v" },
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

  it("supports stopAtFirstPositional for command wrappers without --", async () => {
    let captured: any;
    const terminal = createMemoryTerminal();
    const cli = createTestBaseCli();
    cli.command("exec <cmd> [args...]", {
      stopAtFirstPositional: true,
      flags: { quiet: { type: Boolean, short: "q" } },
      run(ctx) {
        captured = { quiet: ctx.flags.quiet, args: ctx.args };
      },
    });

    await cli.run(["exec", "-q", "git", "--status", "-s"], { terminal });

    expect(captured).toEqual({
      quiet: true,
      args: { cmd: "git", args: ["--status", "-s"] },
    });
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
        tags: { type: [String], delimiter: ",", env: "DEPLOY_TAGS" },
        nums: { type: [Number], delimiter: "," },
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
    ).rejects.toThrow(InvalidParametersError);
  });
});
