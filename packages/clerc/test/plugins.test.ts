import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createMemoryTerminal, createTestCli } from "@clerc/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isNewerVersion,
  strictFlagsPlugin,
  updateNotifierPlugin,
  verbosityPlugin,
} from "../src";

describe("built-in v2 plugins", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirs.splice(0)) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("strictFlagsPlugin rejects unknown flags with suggestion but never blocks --help", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli()
      .use(strictFlagsPlugin())
      .command("build", {
        flags: { output: String },
        run: () => {},
      });

    // --help wins during onIntercept before strictFlags runs in onValidate!
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

  it("verbosityPlugin wires -q and -v to ctx.log", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli()
      .use(verbosityPlugin())
      .command("check", {
        run: (ctx) => {
          ctx.log.info("info-msg");
          ctx.log.debug("debug-msg");
        },
      });

    await cli.run(["check"], { terminal });

    expect(terminal.stdoutText()).toContain("info-msg");
    expect(terminal.stdoutText()).not.toContain("debug-msg");

    terminal.clear();
    await cli.run(["check", "-v"], { terminal });

    expect(terminal.stdoutText()).toContain("debug-msg");

    terminal.clear();
    await cli.run(["check", "-q"], { terminal });

    expect(terminal.stdoutText()).toBe("");
  });

  it("updateNotifierPlugin checks registry with native fetch, caches, and prints Left-Rail callout", async () => {
    const cacheDir = await mkdtemp(path.join(os.tmpdir(), "clerc-update-"));
    tempDirs.push(cacheDir);

    const mockFetch = vi.fn(async () =>
      Response.json(
        { version: "2.1.0" },
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    ) as unknown as typeof globalThis.fetch;

    let currentTime = 1_000_000;
    const terminal = createMemoryTerminal({ isTTY: true, color: false });

    const cli = createTestCli()
      .use(
        updateNotifierPlugin({
          pkg: { name: "acme-cli", version: "2.0.0" },
          cacheDir,
          fetch: mockFetch,
          now: () => currentTime,
          checkIntervalMs: 60_000,
        }),
      )
      .command("run", { run: () => {} });

    await cli.run(["run"], { terminal });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(terminal.stderrText()).toContain("Update available: 2.0.0 → 2.1.0");
    expect(terminal.stderrText()).toContain("Run npm i -g acme-cli to update");

    // Second run within interval uses cache without re-fetching
    terminal.clear();
    currentTime += 10_000;
    await cli.run(["run"], { terminal });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(terminal.stderrText()).toContain("Update available: 2.0.0 → 2.1.0");

    // Skips in CI
    const ciTerminal = createMemoryTerminal({
      isTTY: true,
      env: { CI: "true" },
    });
    currentTime += 120_000;
    await cli.run(["run"], { terminal: ciTerminal });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(ciTerminal.stderrText()).toBe("");
  });

  it("compares semver versions accurately", () => {
    expect(isNewerVersion("1.0.0", "1.0.1")).toBeTruthy();
    expect(isNewerVersion("1.2.3", "2.0.0")).toBeTruthy();
    expect(isNewerVersion("2.0.0", "2.0.0")).toBeFalsy();
    expect(isNewerVersion("2.1.0", "2.0.9")).toBeFalsy();
  });
});
