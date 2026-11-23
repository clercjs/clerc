import { createMemoryTerminal } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { createLogger } from "../src";

describe("@clerc/logger", () => {
  it("renders flush-left word labels, rail/compact details, and grid-aligned Clack notes", () => {
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

    const noteTerm = createMemoryTerminal({ color: false, unicode: true });
    const noteLog = createLogger({ terminal: noteTerm });
    noteLog.note("No remote resources mutated.", "Dry run");
    noteLog.note("Run npm i -g test", "Update available", { tone: "warn" });

    expect(noteTerm.stdoutText()).toMatch(/^note {3}╭─ Dry run /);
    expect(noteTerm.stdoutText()).toContain(
      "\n       │  No remote resources mutated.",
    );
    expect(noteTerm.stderrText()).toMatch(/^warn {3}╭─ Update available /);
    expect(noteTerm.stderrText()).toContain("\n       │  Run npm i -g test");

    const asciiTerm = createMemoryTerminal({ color: false, unicode: false });
    const asciiLog = createLogger({ terminal: asciiTerm });
    asciiLog.note("ASCII body", "ASCII title");

    expect(asciiTerm.stdoutText()).toMatch(/^note {3}\+- ASCII title /);
    expect(asciiTerm.stdoutText()).toContain("\n       |  ASCII body");

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

  it("formats Error chains cleanly, inspects objects via node:util, and serializes JSON", () => {
    const term = createMemoryTerminal({ color: false });
    const log = createLogger({ terminal: term, level: "debug" });

    log.debug("Resolved config", { port: 3000, nested: { ok: true } });
    log.error(
      new TypeError("Invalid port", {
        cause: new Error("PORT env malformed"),
      }),
    );

    expect(term.stdoutText()).toContain("debug  Resolved config");
    expect(term.stdoutText()).toContain("port: 3000");
    expect(term.stderrText()).toContain("error  Invalid port");
    expect(term.stderrText()).toContain("│ TypeError: Invalid port");
    expect(term.stderrText()).toContain("│   at ");
    expect(term.stderrText()).toContain(
      "│ Caused by: Error: PORT env malformed",
    );
    expect(term.stderrText()).not.toContain("[cause]");

    const jsonTerm = createMemoryTerminal({ color: false });
    const jsonLog = createLogger({ terminal: jsonTerm, format: "json" });
    jsonLog.withScope("api").error("Boom", new Error("ECONNREFUSED"));

    const parsed = JSON.parse(jsonTerm.stderrText());

    expect(parsed).toMatchObject({
      level: "error",
      scope: "api",
      message: "Boom",
      detail: {
        name: "Error",
        message: "ECONNREFUSED",
      },
    });
  });

  it("supports streaming .line() appends and graceful non-TTY spinner fallback", () => {
    const term = createMemoryTerminal({ color: false });
    const log = createLogger({ terminal: term, level: "warn" });

    const mutedStep = log.step("Hidden");
    mutedStep.line("Should not appear");

    expect(term.stdoutText()).toBe("");

    const warnEntry = log.warn("Preflight warnings", "Initial check");
    warnEntry.line("Slow upstream response").line("Line A\nLine B");

    expect(term.stderrText()).toBe(
      [
        "warn   Preflight warnings",
        "       │ Initial check",
        "       │ Slow upstream response",
        "       │ Line A",
        "       │ Line B",
      ].join("\n"),
    );

    log.setLevel("info");
    const s = log.spinner();
    s.start("Bundling");
    s.message("2 chunks");
    s.stop("Bundled in 40ms");

    expect(term.stdoutText()).toBe(
      ["step   Bundling", "       │ 2 chunks", "done   Bundled in 40ms"].join(
        "\n",
      ),
    );
  });
});
