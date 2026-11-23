import { createMemoryTerminal, createTestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { createCli, plugin } from "../src";

describe("Unified Plugin & CliApp composition", () => {
  it("runs beforeRun in registration order and afterRun / renderError in reverse (LIFO) order", async () => {
    const events: string[] = [];
    const terminal = createMemoryTerminal();

    const first = plugin("first")
      .hook("beforeRun", () => {
        events.push("before:first");
      })
      .hook("afterRun", () => {
        events.push("after:first");
      })
      .hook("renderError", () => {
        events.push("render:first");

        return true;
      });

    const second = plugin("second")
      .hook("beforeRun", () => {
        events.push("before:second");
      })
      .hook("afterRun", () => {
        events.push("after:second");
      })
      .hook("renderError", (err) => {
        events.push("render:second");

        return err instanceof Error && err.message === "custom";
      });

    const cli = createTestBaseCli().use(first).use(second);
    cli.command("ok", {
      run() {
        events.push("run:ok");
      },
    });
    cli.command("custom-fail", {
      run() {
        throw new Error("custom");
      },
    });
    cli.command("fallback-fail", {
      run() {
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

  it("replaces named plugins atomically on .use() and removes them on .disable()", async () => {
    const terminal = createMemoryTerminal();

    const makeGreetingPlugin = (msg: string) =>
      plugin("demo:greet").command("hi", {
        run(ctx) {
          ctx.terminal.stdout(msg);
        },
      });

    const cli = createCli({ scriptName: "app", version: "1.0.0" })
      .use(makeGreetingPlugin("v1"))
      .use(makeGreetingPlugin("v2"));

    await cli.run(["hi"], { terminal });

    expect(terminal.stdoutText()).toBe("v2");

    cli.disable("demo:greet");

    await expect(cli.run(["hi"], { terminal })).rejects.toThrow();
  });

  it("extends context with typed plugin helpers and short-circuits in intercept before validation", async () => {
    const terminal = createMemoryTerminal();
    let greeting = "";

    const greeterPlugin = plugin("test:greeter")
      .flags({ dry: Boolean })
      .extend((ctx) => ({
        greet: (who: string) => `hello ${who} from ${ctx.meta.scriptName}`,
      }))
      .hook("intercept", (ctx) => {
        if (ctx.flags.dry) {
          ctx.terminal.stdout("dry-run");

          return { handled: true, exitCode: 0 };
        }
      });

    const cli = createTestBaseCli().use(greeterPlugin);
    cli.command("deploy", {
      flags: { token: { type: String, required: true } },
      run(ctx) {
        greeting = ctx.greet("world");
      },
    });

    const dryRes = await cli.run(["deploy", "--dry"], { terminal });

    expect(dryRes.ok).toBeTruthy();
    expect(dryRes.handledBy).toBe("test:greeter");
    expect(terminal.stdoutText()).toBe("dry-run");

    await cli.run(["deploy", "--token", "abc"], { terminal });

    expect(greeting).toBe("hello world from test");
  });
});
