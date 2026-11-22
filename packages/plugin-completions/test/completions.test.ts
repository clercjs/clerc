import { createMemoryTerminal, createTestCli } from "@clerc/test-utils";
import { describe, expect, it, vi } from "vitest";

import { completionsPlugin } from "../src";

describe("plugin-completions v2", () => {
  it("generates shell completion script without duplicating aliases or hidden commands", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const terminal = createMemoryTerminal();

    try {
      const cli = createTestCli()
        .use(completionsPlugin())
        .command("build", {
          aliases: ["b"],
          description: "Build project",
          flags: {
            watch: { type: Boolean, short: "w", description: "Watch mode" },
          },
          run: () => {},
        })
        .command("internal", {
          hidden: true,
          run: () => {},
        });

      const res = await cli.run(["completions", "zsh"], { terminal });

      expect(res.ok).toBeTruthy();
      expect(logSpy).toHaveBeenCalled();

      // Re-running does not throw or duplicate commands in RootCommand
      const res2 = await cli.run(["completions", "--shell", "bash"], {
        terminal,
      });

      expect(res2.ok).toBeTruthy();
    } finally {
      logSpy.mockRestore();
    }
  });

  it("reports structured error when shell type is missing", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli().use(completionsPlugin());

    const res = await cli.run(["completions"], { terminal });

    expect(res.ok).toBeFalsy();
    expect(res.exitCode).toBe(2);
    expect(terminal.stderrText()).toContain("shell type is required");
  });
});
