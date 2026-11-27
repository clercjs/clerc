import { createMemoryTerminal, createTestCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import {
  ClercError,
  Types,
  buildHelpDocument,
  command,
  createTheme,
  formatDiagnostic,
} from "../src";

describe("cli() integration", () => {
  it("handles --version, version, --help, help, and subcommand help natively", async () => {
    const terminal = createMemoryTerminal();
    const app = createTestCli({
      commands: [
        command("build", {
          description: "Build project",
          flags: {
            port: {
              type: Number,
              short: "p",
              default: 3000,
              description: "Port",
            },
          },
          run() {},
        }),
      ],
    });

    const vRes = await app.run(["--version"], { terminal });

    expect(vRes.ok).toBeTruthy();
    expect(terminal.stdoutText()).toBe("test v1.0.0");

    terminal.clear();
    await app.run(["version"], { terminal });

    expect(terminal.stdoutText()).toBe("test v1.0.0");

    terminal.clear();
    await app.run(["help", "build"], { terminal });

    expect(terminal.stdoutText()).toContain("test build v1.0.0\nBuild project");
    expect(terminal.stdoutText()).toContain("-p, --port <number>");
  });

  it("supports customizing help header and disabling strictFlags cleanly", async () => {
    const terminal = createMemoryTerminal();
    const app = createTestCli({
      help: { header: "=== Custom Banner ===" },
      strictFlags: false,
      commands: [command("run", { run() {} })],
    });

    await app.run(["--help"], { terminal });

    expect(terminal.stdoutText()).toContain("=== Custom Banner ===");

    const res = await app.run(["run", "--extra"], { terminal });

    expect(res.ok).toBeTruthy();
  });

  it("renders Cargo/Clap diagnostics with did-you-mean hints natively", async () => {
    const terminal = createMemoryTerminal();
    const app = createTestCli({
      commands: [
        command("build", {
          description: "Build project",
          flags: { port: { type: Number, short: "p" } },
          run() {},
        }),
        command("dev", { description: "Start dev server", run() {} }),
        command("db migrate", { description: "Run migrations", run() {} }),
      ],
    });

    const res = await app.run(["buid"], { terminal });

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

    terminal.clear();
    const typoHelpRes = await app.run(["buid", "--help"], { terminal });

    expect(typoHelpRes.ok).toBeFalsy();
    expect(terminal.stderrText()).toContain("unknown command 'buid'");

    terminal.clear();
    const typoFlagRes = await app.run(["buid", "--port", "8080"], { terminal });

    expect(typoFlagRes.ok).toBeFalsy();
    expect(terminal.stderrText()).toContain("unknown command 'buid'");
    expect(terminal.stderrText()).toContain(
      "a similar command exists: 'build'",
    );

    terminal.clear();
    const nestedHelpTypo = await app.run(["help", "db", "migrat"], {
      terminal,
    });

    expect(nestedHelpTypo.ok).toBeFalsy();
    expect(terminal.stderrText()).toContain(
      "a similar command exists: 'db migrate'",
    );
  });

  it("renders custom ClercError diagnostics and builds help documents", async () => {
    const app = createTestCli({
      commands: [command("build", { description: "Build project", run() {} })],
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

    const doc = await buildHelpDocument(app.buildModel());

    expect(doc.commandGroups[0]?.items[0]?.name).toBe("build");
  });

  it("attaches command usage on structural argument/option errors and suggests similar enum values", async () => {
    const terminal = createMemoryTerminal();
    const app = createTestCli({
      commands: [
        command("deploy <env>", {
          args: { env: Types.Enum("staging", "prod") },
          run() {},
        }),
      ],
    });

    const extraRes = await app.run(["deploy", "pros", "s"], { terminal });

    expect(extraRes.ok).toBeFalsy();
    expect(extraRes.exitCode).toBe(2);
    expect(terminal.stderrText()).toBe(
      [
        "error unexpected argument: 's'",
        "",
        "usage test deploy [options] <env>",
        "",
        "      For more information, try 'test deploy --help'.",
      ].join("\n"),
    );

    terminal.clear();
    const typoEnumRes = await app.run(["deploy", "pros"], { terminal });

    expect(typoEnumRes.ok).toBeFalsy();
    expect(terminal.stderrText()).toContain("invalid value 'pros' for '<env>'");
    expect(terminal.stderrText()).toContain(
      "tip a similar value exists: 'prod'",
    );

    terminal.clear();
    const farEnumRes = await app.run(["deploy", "qa"], { terminal });

    expect(farEnumRes.ok).toBeFalsy();
    expect(terminal.stderrText()).not.toContain("a similar value exists");
  });
});
