import { createMemoryTerminal, createTestCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { UnknownFlagError } from "../src";

describe("built-in strict flags & built-in verbosity", () => {
  it("rejects unknown flags natively with suggestions and never blocks --help", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli();
    cli.command("build", { flags: { output: String }, run() {} });

    const helpRes = await cli.run(["build", "--help", "--outpt"], { terminal });

    expect(helpRes.ok).toBeTruthy();
    expect(terminal.stdoutText()).toContain("test build");

    terminal.clear();
    const errRes = await cli.run(["build", "--outpt"], { terminal });

    expect(errRes.ok).toBeFalsy();
    expect(errRes.exitCode).toBe(2);
    expect(terminal.stderrText()).toContain("unexpected option: '--outpt'");
    expect(terminal.stderrText()).toContain(
      "a similar option exists: '--output'",
    );
  });

  it("wires built-in -q/--quiet and -v/--verbose before middlewares, yields on conflict, and disables via verbosity: false", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli().middleware(async (ctx, next) => {
      ctx.log.debug("mw-debug");
      await next();
    });

    cli.command("check", {
      deprecated: "old command",
      run(ctx) {
        ctx.log.info("info-msg");
        ctx.log.debug("debug-msg");
      },
    });

    cli.command("bump", {
      flags: {
        targetVersion: { type: String, short: "v", description: "Target ver" },
      },
      run(ctx) {
        ctx.log.info(`ver=${ctx.flags.targetVersion ?? "none"}`);
        ctx.log.debug("bump-debug");
      },
    });

    await cli.run(["check"], { terminal });

    expect(terminal.stdoutText()).toContain("info-msg");
    expect(terminal.stdoutText()).not.toContain("debug-msg");
    expect(terminal.stderrText()).toContain("deprecated");

    terminal.clear();
    await cli.run(["check", "-v"], { terminal });

    expect(terminal.stdoutText()).toContain("mw-debug");
    expect(terminal.stdoutText()).toContain("debug-msg");

    terminal.clear();
    await cli.run(["check", "-q"], { terminal });

    expect(terminal.stdoutText()).toBe("");
    expect(terminal.stderrText()).toBe("");

    // Short '-v' yields cleanly to command's own flag while '--verbose' still works
    terminal.clear();
    await cli.run(["bump", "-v", "2.0.0", "--verbose"], { terminal });

    expect(terminal.stdoutText()).toContain("ver=2.0.0");
    expect(terminal.stdoutText()).toContain("bump-debug");

    // verbosity: false disables built-in -q/-v
    const noVerbCli = createTestCli({ verbosity: false });
    noVerbCli.command("ping", { run() {} });

    await expect(
      noVerbCli.run(["ping", "-v"], { terminal, throwOnError: true }),
    ).rejects.toThrow(UnknownFlagError);
  });
});
