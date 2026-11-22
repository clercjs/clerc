import { createMemoryTerminal, createTestCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

describe("clerc Cli() integration", () => {
  it("handles --version, version, --help, help, and subcommand help", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli().command("build", {
      description: "Build project",
      flags: {
        port: { type: Number, short: "p", default: 3000, description: "Port" },
      },
      run: () => {},
    });

    const vRes = await cli.run(["--version"], { terminal });

    expect(vRes.ok).toBeTruthy();
    expect(terminal.stdoutText()).toBe("test v1.0.0");

    terminal.clear();
    await cli.run(["version"], { terminal });

    expect(terminal.stdoutText()).toBe("test v1.0.0");

    terminal.clear();
    await cli.run(["help", "build"], { terminal });

    expect(terminal.stdoutText()).toContain(
      "test build v1.0.0 — Build project",
    );
    expect(terminal.stdoutText()).toContain("-p, --port <number>");
  });

  it("renders Cargo/Clap diagnostics with did-you-mean hints via errorPlugin + notFoundPlugin", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli()
      .command("build", { description: "Build project", run: () => {} })
      .command("dev", { description: "Start dev server", run: () => {} });

    const res = await cli.run(["buid"], { terminal });

    expect(res.ok).toBeFalsy();
    expect(res.exitCode).toBe(2);
    expect(terminal.stderrText()).toBe(
      [
        "error: unknown command 'buid'",
        "",
        "  tip: a similar command exists: 'build'",
        "",
        "For more information, try 'test --help'.",
      ].join("\n"),
    );
  });

  it("renders structured JSON errors when logger format is json", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli().command("build", {
      description: "Build project",
      run: () => {},
    });

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
  });
});
