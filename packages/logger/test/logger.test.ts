import { createMemoryTerminal } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { createLogger } from "../src";

describe("@clerc/logger", () => {
  it("renders aligned word-label compact and rail styles without external dependencies", () => {
    const unicodeTerm = createMemoryTerminal({ color: false, unicode: true });
    const log = createLogger({ terminal: unicodeTerm, level: "debug" });

    log.step("Building");
    log.info("Found 3 files");
    log.success("Built", "12ms");
    log.warn("Deprecated option");
    log.error("Build failed", "syntax error");
    log.debug("internal detail");

    expect(unicodeTerm.stdoutText()).toBe(
      [
        " step  Building",
        " info  Found 3 files",
        " done  Built",
        "       12ms",
        "debug  internal detail",
      ].join("\n"),
    );
    expect(unicodeTerm.stderrText()).toBe(
      [
        " warn  Deprecated option",
        "error  Build failed",
        "       syntax error",
      ].join("\n"),
    );

    const asciiTerm = createMemoryTerminal({ color: false, unicode: false });
    const asciiLog = createLogger({ terminal: asciiTerm, style: "rail" });
    asciiLog.step("Init", "loading config");
    asciiLog.callout({
      tone: "warn",
      title: "Update available",
      lines: ["Run npm i -g test"],
    });

    expect(asciiTerm.stdoutText()).toBe(
      [" step  Init", "    |  loading config"].join("\n"),
    );
    expect(asciiTerm.stderrText()).toBe(
      [" warn  Update available", "    |  Run npm i -g test"].join("\n"),
    );
  });

  it("supports scoped loggers, ANSI colors, and JSON output mode", () => {
    const colorTerm = createMemoryTerminal({ color: true });
    const colored = createLogger({ terminal: colorTerm });
    colored.step("Running");

    expect(colorTerm.stdoutText()).toContain("\u001B[");

    const term = createMemoryTerminal({ color: false });
    const log = createLogger({ terminal: term, format: "json" });
    const scoped = log.withScope("parser");
    scoped.info("parsed args", "3 flags");

    expect(JSON.parse(term.stdoutText())).toEqual({
      level: "info",
      scope: "parser",
      message: "parsed args",
      detail: "3 flags",
    });
  });
});
