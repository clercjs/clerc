import { createMemoryTerminal, createTestCli } from "@clerc/test-utils";
import { describe, expect, it, vi } from "vitest";

import { completionsPlugin } from "../src";

describe("plugin-completions v2", () => {
  it("generates zsh, bash, and valid fish completion scripts without duplicating commands", async () => {
    const outputs: string[] = [];
    const logSpy = vi.spyOn(console, "log").mockImplementation((msg) => {
      outputs.push(String(msg));
    });
    const terminal = createMemoryTerminal();

    try {
      const cli = createTestCli({ defaultCommand: "build" }).use(
        completionsPlugin(),
      );
      cli.command("build [env]", {
        aliases: ["b"],
        description: "Build project",
        args: {
          env: {
            description: "Target env",
            type: {
              "display": "dev|prod",
              "~standard": {
                version: 1,
                vendor: "test",
                validate: (v) => ({ value: String(v) }),
                jsonSchema: {
                  input: () => ({ type: "string", enum: ["dev", "prod"] }),
                },
              },
            },
          },
        },
        flags: {
          dryRun: { type: Boolean, short: "n", description: "Dry run" },
          watch: { type: Boolean, short: "w", description: "Watch mode" },
        },
        run() {},
      });
      cli.command("internal", { hidden: true, run() {} });

      const res = await cli.run(["completions", "zsh"], { terminal });

      expect(res.ok).toBeTruthy();
      expect(logSpy).toHaveBeenCalled();

      const res2 = await cli.run(["completions", "--shell", "bash"], {
        terminal,
      });

      expect(res2.ok).toBeTruthy();

      outputs.length = 0;
      const fishRes = await cli.run(["completions", "fish"], { terminal });

      expect(fishRes.ok).toBeTruthy();

      const fishScript = outputs.join("\n");

      // Regression check: ShellCompDirectiveError must be defined inside the function scope in fish
      expect(fishScript).toContain("function __test_perform_completion");
      expect(fishScript).toContain("set -l directive");

      // Dynamic runtime completion: kebab-case flags (--dry-run), alias ('b'), and automatic enum values
      outputs.length = 0;
      await cli.run(["complete", "--", "--dry"], { terminal });

      expect(outputs.join("\n")).toContain("--dry-run");
      expect(outputs.join("\n")).not.toContain("--dryRun");

      outputs.length = 0;
      await cli.run(["complete", "--", "b", ""], { terminal });

      expect(outputs.join("\n")).toContain("dev");
      expect(outputs.join("\n")).toContain("prod");
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
