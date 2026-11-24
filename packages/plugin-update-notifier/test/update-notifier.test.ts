import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createMemoryTerminal, createTestCli } from "@clerc/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { updateNotifierPlugin } from "../src";

describe("@clerc/plugin-update-notifier", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirs.splice(0)) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("checks registry concurrently, caches results, skips CI, and prints banner after execution", async () => {
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

    const cli = createTestCli({ name: "acme-cli", version: "2.0.0" }).use(
      updateNotifierPlugin({
        cacheDir,
        fetch: mockFetch,
        now: () => currentTime,
        checkIntervalMs: 60_000,
      }),
    );
    cli.command("run", { run() {} });

    await cli.run(["run"], { terminal });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(terminal.stderrText()).toContain("Update available: 2.0.0 → 2.1.0");
    expect(terminal.stderrText()).toContain("Run npm i -g acme-cli to update");

    terminal.clear();
    currentTime += 10_000;
    await cli.run(["run"], { terminal });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(terminal.stderrText()).toContain("Update available: 2.0.0 → 2.1.0");

    // Quiet mode (-q) suppresses warn box
    terminal.clear();
    await cli.run(["run", "-q"], { terminal });

    expect(terminal.stderrText()).toBe("");

    const ciTerminal = createMemoryTerminal({
      isTTY: true,
      env: { CI: "true" },
    });
    currentTime += 120_000;
    await cli.run(["run"], { terminal: ciTerminal });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(ciTerminal.stderrText()).toBe("");

    // Prerelease current version (2.1.0-beta.1) detects stable 2.1.0 as newer
    const preCacheDir = await mkdtemp(path.join(os.tmpdir(), "clerc-pre-"));
    tempDirs.push(preCacheDir);
    const preTerm = createMemoryTerminal({ isTTY: true, color: false });
    const preCli = createTestCli({
      name: "acme-cli",
      version: "2.1.0-beta.1",
    }).use(
      updateNotifierPlugin({
        cacheDir: preCacheDir,
        fetch: mockFetch,
        now: () => currentTime,
      }),
    );
    preCli.command("run", { run() {} });
    await preCli.run(["run"], { terminal: preTerm });

    expect(preTerm.stderrText()).toContain(
      "Update available: 2.1.0-beta.1 → 2.1.0",
    );
  });
});
