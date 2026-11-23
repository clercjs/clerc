import { createMemoryTerminal, createTestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { Cli, plugin } from "../src";

describe("Unified Plugin & CliApp composition", () => {
  it("runs middleware in onion order and onError in reverse (LIFO) order", async () => {
    const events: string[] = [];
    const terminal = createMemoryTerminal();

    const first = plugin("first")
      .middleware(async (_, next) => {
        events.push("before:first");
        await next();
        events.push("after:first");
      })
      .onError(() => {
        events.push("error:first");

        return true;
      });

    const second = plugin("second")
      .middleware(async (_, next) => {
        events.push("before:second");
        await next();
        events.push("after:second");
      })
      .onError((err) => {
        events.push("error:second");

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

    expect(customRes.ok).toBeFalsy();
    expect(events).toEqual(["before:first", "before:second", "error:second"]);

    events.length = 0;
    const fallbackRes = await cli.run(["fallback-fail"], { terminal });

    expect(fallbackRes.ok).toBeFalsy();
    expect(events).toEqual([
      "before:first",
      "before:second",
      "error:second",
      "error:first",
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

    const cli = Cli({ scriptName: "app", version: "1.0.0" })
      .use(makeGreetingPlugin("v1"))
      .use(makeGreetingPlugin("v2"));

    await cli.run(["hi"], { terminal });

    expect(terminal.stdoutText()).toBe("v2");

    cli.disable("demo:greet");
    const res = await cli.run(["hi"], { terminal });

    expect(res.ok).toBeFalsy();
    expect(res.exitCode).toBe(2);
  });

  it("derives async context in extend() using resolved flags", async () => {
    const terminal = createMemoryTerminal();
    let observed = "";

    const configPlugin = plugin("test:config")
      .flags({ config: { type: String, default: "default.json" } })
      .extend(async (ctx) => ({
        loadedConfig: await Promise.resolve(`loaded:${ctx.flags.config}`),
      }));

    const cli = createTestBaseCli().use(configPlugin);
    cli.command("deploy", {
      run(ctx) {
        observed = ctx.loadedConfig;
      },
    });

    await cli.run(["deploy"], { terminal });

    expect(observed).toBe("loaded:default.json");

    await cli.run(["deploy", "--config", "prod.json"], { terminal });

    expect(observed).toBe("loaded:prod.json");
    expect(Object.keys(configPlugin)).toEqual(["pluginName"]);
  });
});
