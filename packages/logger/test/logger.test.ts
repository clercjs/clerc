import { createMemoryTerminal } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { createLogger } from "../src";

describe("@clerc/logger", () => {
  it("renders flush-left word labels with body-aligned rail and compact styles", () => {
    const unicodeTerm = createMemoryTerminal({ color: false, unicode: true });
    const log = createLogger({ terminal: unicodeTerm, level: "debug" });

    log.step("Building");
    log.info("Found 3 files");
    log.success("Built", "12ms");
    log.warn("Deprecated option");
    log.error("Build failed", "syntax error");
    log.withScope("db").withScope("migrate").debug("Query took 1.2ms");

    expect(unicodeTerm.stdoutText()).toBe(
      [
        "step   Building",
        "info   Found 3 files",
        "done   Built",
        "       │ 12ms",
        "debug  db:migrate › Query took 1.2ms",
      ].join("\n"),
    );
    expect(unicodeTerm.stderrText()).toBe(
      [
        "warn   Deprecated option",
        "error  Build failed",
        "       │ syntax error",
      ].join("\n"),
    );

    const asciiTerm = createMemoryTerminal({ color: false, unicode: false });
    const asciiLog = createLogger({ terminal: asciiTerm });
    asciiLog.withScope("db").step("Init", "loading config");
    asciiLog.callout({
      tone: "warn",
      title: "Update available",
      lines: ["Run npm i -g test"],
    });

    expect(asciiTerm.stdoutText()).toBe(
      ["step   db > Init", "       | loading config"].join("\n"),
    );
    expect(asciiTerm.stderrText()).toBe(
      ["warn   Update available", "       | Run npm i -g test"].join("\n"),
    );

    const compactTerm = createMemoryTerminal({ color: false });
    const compactLog = createLogger({
      terminal: compactTerm,
      style: "compact",
    });
    compactLog.step("Compact", "plain detail");

    expect(compactTerm.stdoutText()).toBe(
      ["step   Compact", "       plain detail"].join("\n"),
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

  it("supports streaming .line() appends on callout and log entries while respecting levels", () => {
    const term = createMemoryTerminal({ color: false });
    const log = createLogger({ terminal: term, level: "warn" });

    // Filtered info callout returns a no-op handle — never prints orphaned rail lines
    const mutedBox = log.callout({ tone: "info", title: "Hidden" });
    mutedBox.line("Should not appear");

    expect(term.stdoutText()).toBe("");

    // Active warn callout streams appended lines to stderr
    const warnBox = log.callout({
      tone: "warn",
      title: "Preflight warnings",
      lines: ["Initial check"],
    });
    warnBox.line("Slow upstream response").line("Line A\nLine B");

    expect(term.stderrText()).toBe(
      [
        "warn   Preflight warnings",
        "       │ Initial check",
        "       │ Slow upstream response",
        "       │ Line A",
        "       │ Line B",
      ].join("\n"),
    );

    // Step streaming on info level
    log.setLevel("info");
    const step = log.step("Migrating");
    step.line("0001_init.sql").line("0002_index.sql");

    expect(term.stdoutText()).toBe(
      [
        "step   Migrating",
        "       │ 0001_init.sql",
        "       │ 0002_index.sql",
      ].join("\n"),
    );
  });
});
