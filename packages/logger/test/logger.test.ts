import { PassThrough } from "node:stream";

import { createMemoryTerminal } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { createLogger } from "../src";
import { confirm, select, text } from "../src/prompts";

describe("@clerc/logger", () => {
  it("renders right-aligned word labels, variadic details, child scopes, and isomorphic log.box.* panels", () => {
    const unicodeTerm = createMemoryTerminal({ color: false, unicode: true });
    const log = createLogger({ terminal: unicodeTerm, level: "debug" });

    log.step("Building", "entry: src/index.ts", "minify: true");
    log.info("Found 3 files");
    log.success("Built", "12ms");
    log.warn("Deprecated option");
    log.error("Build failed", "syntax error");
    log.child("db").child("migrate").debug("Query took 1.2ms");

    expect(unicodeTerm.stdoutText()).toBe(
      [
        " step Building",
        "      │ entry: src/index.ts",
        "      │ minify: true",
        " info Found 3 files",
        " done Built",
        "      │ 12ms",
        "debug db:migrate › Query took 1.2ms",
      ].join("\n"),
    );
    expect(unicodeTerm.stderrText()).toBe(
      [
        " warn Deprecated option",
        "error Build failed",
        "      │ syntax error",
      ].join("\n"),
    );

    const boxTerm = createMemoryTerminal({ color: false, unicode: true });
    const boxLog = createLogger({ terminal: boxTerm });
    boxLog.box.info(
      "Dry run",
      "No remote resources mutated.",
      "Pass --confirm to publish.",
    );
    boxLog.box.warn("Update available", "Run npm i -g test");
    boxLog.box.error(new TypeError("Invalid port"));

    expect(boxTerm.stdoutText()).toMatch(/^ info ╭─ Dry run /);
    expect(boxTerm.stdoutText()).toContain(
      "\n      │  No remote resources mutated.",
    );
    expect(boxTerm.stdoutText()).toContain(
      "\n      │  Pass --confirm to publish.",
    );
    expect(boxTerm.stderrText()).toMatch(/^ warn ╭─ Update available /);
    expect(boxTerm.stderrText()).toContain("\n      │  Run npm i -g test");
    expect(boxTerm.stderrText()).toContain("error ╭─ Invalid port ");
    expect(boxTerm.stderrText()).toContain("│  TypeError: Invalid port");

    const asciiTerm = createMemoryTerminal({ color: false, unicode: false });
    const asciiLog = createLogger({ terminal: asciiTerm });
    asciiLog.box.step("ASCII title", "ASCII body");

    expect(asciiTerm.stdoutText()).toMatch(/^ step \+- ASCII title /);
    expect(asciiTerm.stdoutText()).toContain("\n      |  ASCII body");
  });

  it("formats Error chains cleanly and inspects objects via node:util", () => {
    const term = createMemoryTerminal({ color: false });
    const log = createLogger({ terminal: term, level: "debug" });

    log.debug("Resolved config", { port: 3000, nested: { ok: true } });
    log.error(
      new TypeError("Invalid port", {
        cause: new Error("PORT env malformed"),
      }),
    );

    expect(term.stdoutText()).toContain("debug Resolved config");
    expect(term.stdoutText()).toContain("port: 3000");
    expect(term.stderrText()).toContain("error Invalid port");
    expect(term.stderrText()).toContain("│ TypeError: Invalid port");
    expect(term.stderrText()).toContain("│   at ");
    expect(term.stderrText()).toContain(
      "│ Caused by: Error: PORT env malformed",
    );
    expect(term.stderrText()).not.toContain("[cause]");
  });

  it("supports mutable properties, streaming .line(), reusable explicit spinner(), and auto task()", async () => {
    const term = createMemoryTerminal({ color: false });
    const log = createLogger({ terminal: term, level: "warn" });

    const mutedStep = log.step("Hidden");
    mutedStep.line("Should not appear");

    expect(term.stdoutText()).toBe("");

    const warnEntry = log.warn("Preflight warnings", "Initial check");
    warnEntry.line("Slow upstream response", "Line A\nLine B");

    expect(term.stderrText()).toBe(
      [
        " warn Preflight warnings",
        "      │ Initial check",
        "      │ Slow upstream response",
        "      │ Line A",
        "      │ Line B",
      ].join("\n"),
    );

    log.level = "info";
    const spin = log.spinner();
    spin.start("Phase 1");
    spin.message("checking");
    spin.stop("Phase 1 done");
    spin.start("Phase 2");
    spin.stop("Phase 2 done");

    expect(term.stdoutText()).toBe(
      [
        " step Phase 1",
        "      │ checking",
        " done Phase 1 done",
        " step Phase 2",
        " done Phase 2 done",
      ].join("\n"),
    );

    term.clear();
    const out = await log.task("Bundling...", async (s) => {
      s.message("2 chunks");

      return "Bundled in 40ms";
    });

    expect(out).toBe("Bundled in 40ms");
    expect(term.stdoutText()).toBe(
      [" step Bundling...", "      │ 2 chunks", " done Bundled in 40ms"].join(
        "\n",
      ),
    );

    term.clear();

    await expect(
      log.task("Deploying...", async () => {
        throw new Error("Connection reset");
      }),
    ).rejects.toThrow("Connection reset");

    expect(term.stderrText()).toBe("");

    term.clear();

    await expect(
      log.task(
        "Deploying...",
        async () => {
          throw new Error("Connection reset");
        },
        { errorMessage: "Deploy failed" },
      ),
    ).rejects.toThrow("Connection reset");

    expect(term.stderrText()).toBe("error Deploy failed");
  });

  it("guards interactive prompts in non-TTY terminals unless custom streams are provided", async () => {
    const stdinDesc = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    const stdoutDesc = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      configurable: true,
    });
    Object.defineProperty(process.stdout, "isTTY", {
      value: false,
      configurable: true,
    });

    try {
      await expect(text({ message: "Name?" })).rejects.toThrow(
        "Interactive prompts require a TTY terminal",
      );
      await expect(confirm({ message: "Continue?" })).rejects.toThrow(
        "Interactive prompts require a TTY terminal",
      );
      await expect(
        select({
          message: "Pick one",
          options: [{ value: "a", label: "A" }],
        }),
      ).rejects.toThrow("Interactive prompts require a TTY terminal");

      const input = new PassThrough();
      const output = new PassThrough();
      const promptPromise = confirm({
        message: "Proceed?",
        initialValue: true,
        input,
        output,
      });
      input.write("\r");
      const answer = await promptPromise;

      expect(answer).toBeTruthy();
    } finally {
      if (stdinDesc) {
        Object.defineProperty(process.stdin, "isTTY", stdinDesc);
      } else {
        delete (process.stdin as { isTTY?: boolean }).isTTY;
      }
      if (stdoutDesc) {
        Object.defineProperty(process.stdout, "isTTY", stdoutDesc);
      } else {
        delete (process.stdout as { isTTY?: boolean }).isTTY;
      }
    }
  });
});
