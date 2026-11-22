import { createMemoryTerminal, createTestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { Clerc, definePlugin } from "../src";

describe("Typed Hook Plugin System", () => {
  it("runs beforeRun in registration order and afterRun / onRenderError in reverse (LIFO) order", async () => {
    const events: string[] = [];
    const terminal = createMemoryTerminal();

    const first = definePlugin({
      name: "first",
      hooks: {
        beforeRun: () => {
          events.push("before:first");
        },
        afterRun: () => {
          events.push("after:first");
        },
        onRenderError: () => {
          events.push("render:first");

          return true;
        },
      },
    });

    const second = definePlugin({
      name: "second",
      hooks: {
        beforeRun: () => {
          events.push("before:second");
        },
        afterRun: () => {
          events.push("after:second");
        },
        onRenderError: (err) => {
          events.push("render:second");

          // Handle custom errors; fall back to earlier renderer otherwise
          return err instanceof Error && err.message === "custom";
        },
      },
    });

    const cli = createTestBaseCli()
      .use(first)
      .use(second)
      .command("ok", {
        run: () => {
          events.push("run:ok");
        },
      })
      .command("custom-fail", {
        run: () => {
          throw new Error("custom");
        },
      })
      .command("fallback-fail", {
        run: () => {
          throw new Error("other");
        },
      });

    await cli.run(["ok"], { terminal });

    expect(events).toEqual([
      "before:first",
      "before:second",
      "run:ok",
      "after:second",
      "after:first",
    ]);

    events.length = 0;
    const customRes = await cli.run(["custom-fail"], { terminal });

    expect(customRes.handledBy).toBe("second");
    expect(events).toEqual(["before:first", "before:second", "render:second"]);

    events.length = 0;
    const fallbackRes = await cli.run(["fallback-fail"], { terminal });

    expect(fallbackRes.handledBy).toBe("first");
    expect(events).toEqual([
      "before:first",
      "before:second",
      "render:second",
      "render:first",
    ]);
  });

  it("deduplicates plugins by name and lazily resolves commands with final scriptName", async () => {
    const terminal = createMemoryTerminal();
    let seenScriptName = "";

    const infoPlugin = definePlugin({
      name: "test:info",
      commands: (meta) => [
        {
          name: "whoami",
          run: () => {
            seenScriptName = meta.scriptName;
          },
        },
      ],
    });

    const cli = Clerc.create()
      .use(infoPlugin)
      .use(infoPlugin) // duplicate ignored
      .scriptName("late-name")
      .version("2.0.0");

    await cli.run(["whoami"], { terminal });

    expect(seenScriptName).toBe("late-name");
  });

  it("extends context with typed plugin helpers and short-circuits in onIntercept before validation", async () => {
    const terminal = createMemoryTerminal();
    let greeting = "";

    const greeterPlugin = definePlugin({
      name: "test:greeter",
      globalFlags: {
        dry: { type: Boolean },
      } as const,
      extendContext: (ctx) => ({
        greet: (who: string) => `hello ${who} from ${ctx.meta.scriptName}`,
      }),
      hooks: {
        onIntercept: (ctx) => {
          if (ctx.flags.dry) {
            ctx.terminal.stdout("dry-run");

            return { handled: true, exitCode: 0 };
          }
        },
      },
    });

    const cli = createTestBaseCli()
      .use(greeterPlugin)
      .command("deploy", {
        flags: {
          token: { type: String, required: true },
        },
        run: (ctx) => {
          greeting = ctx.greet("world");
        },
      });

    // --dry short-circuits BEFORE required --token validation!
    const dryRes = await cli.run(["deploy", "--dry"], { terminal });

    expect(dryRes.ok).toBeTruthy();
    expect(dryRes.handledBy).toBe("test:greeter");
    expect(terminal.stdoutText()).toBe("dry-run");

    await cli.run(["deploy", "--token", "abc"], { terminal });

    expect(greeting).toBe("hello world from test");
  });
});
