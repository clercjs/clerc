import { describe, expect, it } from "vitest";

import {
  ClercError,
  createLogger,
  createMemoryTerminal,
  createTheme,
  formatDiagnostic,
} from "../src";

describe("Theme, Logger, and Diagnostic Formatter", () => {
  it("renders compact and rail logger styles with Unicode and ASCII fallbacks", () => {
    const unicodeTerm = createMemoryTerminal({ color: false, unicode: true });
    const theme = createTheme(false);
    const log = createLogger({ terminal: unicodeTerm, theme, level: "debug" });

    log.step("Building");
    log.info("Found 3 files");
    log.success("Built", "12ms");
    log.warn("Deprecated option");
    log.error("Build failed", "syntax error");
    log.debug("internal detail");

    expect(unicodeTerm.stdoutText()).toBe(
      [
        "  → Building",
        "  ℹ Found 3 files",
        "  ✓ Built",
        "    12ms",
        "  · internal detail",
      ].join("\n"),
    );
    expect(unicodeTerm.stderrText()).toBe(
      ["  ▲ Deprecated option", "  ✖ Build failed", "    syntax error"].join(
        "\n",
      ),
    );

    const asciiTerm = createMemoryTerminal({ color: false, unicode: false });
    const asciiLog = createLogger({
      terminal: asciiTerm,
      theme,
      style: "rail",
    });
    asciiLog.step("Init", "loading config");
    asciiLog.callout({
      tone: "warn",
      title: "Update available",
      lines: ["Run npm i -g test"],
    });

    expect(asciiTerm.stdoutText()).toBe(
      ["*  Init", "|  loading config"].join("\n"),
    );
    expect(asciiTerm.stderrText()).toBe(
      ["!  Update available", "|  Run npm i -g test"].join("\n"),
    );
  });

  it("supports scoped loggers and JSON output mode", () => {
    const term = createMemoryTerminal({ color: false });
    const log = createLogger({
      terminal: term,
      theme: createTheme(false),
      format: "json",
    });

    const scoped = log.withScope("parser");
    scoped.info("parsed args", "3 flags");

    expect(JSON.parse(term.stdoutText())).toEqual({
      level: "info",
      scope: "parser",
      message: "parsed args",
      detail: "3 flags",
    });
  });

  it("applies ANSI colors only when theme is enabled", () => {
    const colored = createTheme(true);
    const plain = createTheme(false);

    expect(colored.error("error:")).toContain("\u001B[");
    expect(plain.error("error:")).toBe("error:");
  });

  it("formats ClercError with Cargo/Clap diagnostic layout", () => {
    const err = new ClercError("unknown command 'buid'", {
      code: "ERR_UNKNOWN_COMMAND",
      exitCode: 2,
      hints: ["a similar command exists: 'build'"],
      usage: "test <command> [options]",
    });

    const output = formatDiagnostic(err, {
      theme: createTheme(false),
      scriptName: "test",
    });

    expect(output).toBe(
      [
        "error: unknown command 'buid'",
        "",
        "  tip: a similar command exists: 'build'",
        "",
        "Usage: test <command> [options]",
        "",
        "For more information, try 'test --help'.",
      ].join("\n"),
    );
  });
});
