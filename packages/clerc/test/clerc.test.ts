import { createMemoryTerminal, createTestCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import {
  ClercError,
  buildHelpDocument,
  createTheme,
  formatDiagnostic,
} from "../src";

describe("clerc() integration", () => {
  it("handles --version, version, --help, help, and subcommand help natively", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli();
    cli.command("build", {
      description: "Build project",
      flags: {
        port: { type: Number, short: "p", default: 3000, description: "Port" },
      },
      run() {},
    });

    const vRes = await cli.run(["--version"], { terminal });

    expect(vRes.ok).toBeTruthy();
    expect(terminal.stdoutText()).toBe("test v1.0.0");

    terminal.clear();
    await cli.run(["version"], { terminal });

    expect(terminal.stdoutText()).toBe("test v1.0.0");

    terminal.clear();
    await cli.run(["help", "build"], { terminal });

    expect(terminal.stdoutText()).toContain("test build v1.0.0\nBuild project");
    expect(terminal.stdoutText()).toContain("-p, --port <number>");
  });

  it("supports customizing help header and disabling strictFlags cleanly", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli({
      help: { header: "=== Custom Banner ===" },
      strictFlags: false,
    });
    cli.command("run", { run() {} });

    await cli.run(["--help"], { terminal });

    expect(terminal.stdoutText()).toContain("=== Custom Banner ===");

    const res = await cli.run(["run", "--extra"], { terminal });

    expect(res.ok).toBeTruthy();
  });

  it("renders Cargo/Clap diagnostics with did-you-mean hints natively", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli();
    cli.command("build", {
      description: "Build project",
      flags: { port: { type: Number, short: "p" } },
      run() {},
    });
    cli.command("dev", { description: "Start dev server", run() {} });
    cli.command("db migrate", { description: "Run migrations", run() {} });

    const res = await cli.run(["buid"], { terminal });

    expect(res.ok).toBeFalsy();
    expect(res.exitCode).toBe(2);
    expect(terminal.stderrText()).toBe(
      [
        "error unknown command 'buid'",
        "",
        "  tip a similar command exists: 'build'",
        "",
        "      For more information, try 'test --help'.",
      ].join("\n"),
    );

    // Unknown command with --help still reports the typo instead of root help
    terminal.clear();
    const typoHelpRes = await cli.run(["buid", "--help"], { terminal });

    expect(typoHelpRes.ok).toBeFalsy();
    expect(terminal.stderrText()).toContain("unknown command 'buid'");

    // Unknown command with subcommand-local flags still reports the command typo instead of blaming the flag
    terminal.clear();
    const typoFlagRes = await cli.run(["buid", "--port", "8080"], { terminal });

    expect(typoFlagRes.ok).toBeFalsy();
    expect(terminal.stderrText()).toContain("unknown command 'buid'");
    expect(terminal.stderrText()).toContain(
      "a similar command exists: 'build'",
    );

    // Nested help command typo resolves deepest parentPath for suggestions
    terminal.clear();
    const nestedHelpTypo = await cli.run(["help", "db", "migrat"], {
      terminal,
    });

    expect(nestedHelpTypo.ok).toBeFalsy();
    expect(terminal.stderrText()).toContain(
      "a similar command exists: 'db migrate'",
    );
  });

  it("renders structured JSON errors when logger format is json", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli();
    cli.command("build", { description: "Build project", run() {} });

    const res = await cli.run(["buid"], {
      terminal,
      logger: { format: "json" },
    });

    expect(res.ok).toBeFalsy();
    expect(res.exitCode).toBe(2);
    expect(JSON.parse(terminal.stderrText())).toEqual({
      error: {
        code: "ERR_UNKNOWN_COMMAND",
        message: "unknown command 'buid'",
        hints: ["a similar command exists: 'build'"],
        exitCode: 2,
      },
    });

    const customErr = new ClercError("missing target", {
      code: "ERR_MISSING_ARGUMENT",
      usage: "test deploy <env>",
    }).addHint("pass 'staging' or 'prod'");

    expect(
      formatDiagnostic(customErr, { theme: createTheme(false), name: "test" }),
    ).toBe(
      [
        "error missing target",
        "",
        "  tip pass 'staging' or 'prod'",
        "",
        "usage test deploy <env>",
        "",
        "      For more information, try 'test --help'.",
      ].join("\n"),
    );

    const doc = await buildHelpDocument(cli.buildModel());

    expect(doc.commandGroups[0]?.items[0]?.name).toBe("build");
  });
});
