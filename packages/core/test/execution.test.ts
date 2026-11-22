import { createMemoryTerminal, createTestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import {
  FlagConflictError,
  FlagImpliesError,
  MissingRequiredFlagError,
  MissingRequiredParameterError,
  NoCommandError,
  UnknownCommandError,
  ValidationError,
} from "../src";

describe("Clerc execution pipeline", () => {
  it("supports parameters, variadic, double-dash, and flags", async () => {
    let result: any;
    const terminal = createMemoryTerminal();

    const cli = createTestBaseCli().command("copy", {
      parameters: ["<src>", "[dest]", "--", "[extra...]"] as const,
      flags: {
        force: { type: Boolean, short: "f" },
        retries: { type: Number, short: "r", default: 3 },
      },
      run: (ctx) => {
        result = {
          parameters: ctx.parameters,
          flags: ctx.flags,
        };
      },
    });

    await cli.run(
      ["copy", "a.txt", "b.txt", "-f", "--retries", "5", "--", "x", "y"],
      {
        terminal,
      },
    );

    expect(result).toEqual({
      parameters: { src: "a.txt", dest: "b.txt", extra: ["x", "y"] },
      flags: { force: true, retries: 5 },
    });
  });

  it("respects --no-<flag> negation when boolean flag defaults to true", async () => {
    let captured: boolean | undefined;
    const terminal = createMemoryTerminal();

    const cli = createTestBaseCli().command("build", {
      flags: {
        cache: { type: Boolean, default: true },
      },
      run: (ctx) => {
        captured = ctx.flags.cache;
      },
    });

    await cli.run(["build"], { terminal });

    expect(captured).toBeTruthy();

    await cli.run(["build", "--no-cache"], { terminal });

    expect(captured).toBeFalsy();
  });

  it("validates Number parameters with ValidationError on NaN", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestBaseCli().command("wait", {
      parameters: [{ key: "<seconds>", type: Number }] as const,
      run: () => {},
    });

    await expect(cli.run(["wait", "abc"], { terminal })).rejects.toThrow(
      ValidationError,
    );
  });

  it("resolves env fallbacks for flags and skips missing required error when env is set", async () => {
    let captured: any;
    const terminal = createMemoryTerminal({
      env: { API_TOKEN: "secret-123", PORT: "4000", ENABLE_CACHE: "true" },
    });

    const cli = createTestBaseCli().command("serve", {
      flags: {
        token: { type: String, required: true, env: "API_TOKEN" },
        port: { type: Number, env: "PORT", default: 3000 },
        cache: { type: Boolean, env: "ENABLE_CACHE" },
      },
      run: (ctx) => {
        captured = ctx.flags;
      },
    });

    await cli.run(["serve"], { terminal });

    expect(captured).toEqual({
      token: "secret-123",
      port: 4000,
      cache: true,
    });
  });

  it("enforces required flags, conflicts, implies, and validates Number", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestBaseCli().command("deploy", {
      flags: {
        token: { type: String, required: true, env: "DEPLOY_TOKEN" },
        port: { type: Number },
        json: { type: Boolean, conflicts: "yaml" },
        yaml: { type: Boolean },
        tlsKey: { type: String, implies: "tlsCert" },
        tlsCert: { type: String },
      },
      run: () => {},
    });

    await expect(cli.run(["deploy"], { terminal })).rejects.toThrow(
      MissingRequiredFlagError,
    );

    await expect(
      cli.run(["deploy", "--token", "ok", "--port", "not-a-num"], { terminal }),
    ).rejects.toThrow(ValidationError);

    await expect(
      cli.run(["deploy", "--token", "ok", "--json", "--yaml"], { terminal }),
    ).rejects.toThrow(FlagConflictError);

    await expect(
      cli.run(["deploy", "--token", "ok", "--tls-key", "k.pem"], { terminal }),
    ).rejects.toThrow(FlagImpliesError);
  });

  it("supports lazy command loading via load()", async () => {
    let ran = false;
    const terminal = createMemoryTerminal();

    const cli = createTestBaseCli().command("heavy", {
      load: async () => ({
        default: async (ctx) => {
          ran = true;
          ctx.log.success("loaded");
        },
      }),
    });

    const res = await cli.run(["heavy"], { terminal });

    expect(res.ok).toBeTruthy();
    expect(ran).toBeTruthy();
    expect(terminal.stdoutText()).toContain("loaded");
  });

  it("emits deprecation warnings for deprecated commands and flags", async () => {
    const terminal = createMemoryTerminal();

    const cli = createTestBaseCli().command("old", {
      deprecated: "use new instead",
      flags: {
        legacy: { type: Boolean, deprecated: true },
      },
      run: () => {},
    });

    await cli.run(["old", "--legacy"], { terminal });

    expect(terminal.stderrText()).toContain(
      "Command 'old' is deprecated: use new instead",
    );
    expect(terminal.stderrText()).toContain("Option '--legacy' is deprecated");
  });

  it("runs beforeRun and afterRun hooks in order and is purely re-entrant", async () => {
    const events: string[] = [];
    const terminal = createMemoryTerminal();

    const cli = createTestBaseCli()
      .beforeRun((ctx) => {
        events.push(`before:${ctx.calledAs}`);
      })
      .afterRun((ctx) => {
        events.push(`after:${ctx.calledAs}`);
      })
      .command("a", {
        run: () => {
          events.push("run:a");
        },
      })
      .command("b", {
        run: () => {
          events.push("run:b");
        },
      });

    await cli.run(["a"], { terminal });
    await cli.run(["b"], { terminal });

    expect(events).toEqual([
      "before:a",
      "run:a",
      "after:a",
      "before:b",
      "run:b",
      "after:b",
    ]);
  });

  it("throws NoCommandError, UnknownCommandError, and MissingRequiredParameterError", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestBaseCli().command("greet", {
      parameters: ["<name>"] as const,
      run: () => {},
    });

    await expect(cli.run([], { terminal })).rejects.toThrow(NoCommandError);
    await expect(cli.run(["nope"], { terminal })).rejects.toThrow(
      UnknownCommandError,
    );
    await expect(cli.run(["greet"], { terminal })).rejects.toThrow(
      MissingRequiredParameterError,
    );
  });
});
