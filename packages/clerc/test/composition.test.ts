import { createMemoryTerminal, createTestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { clerc, plugin } from "../src";

describe("Unified Plugin & Clerc composition", () => {
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

    const cli = createTestBaseCli()
      .middleware(
        async (_, next) => {
          events.push("before:post");
          await next();
          events.push("after:post");
        },
        { enforce: "post" },
      )
      .use(first)
      .use(second)
      .middleware(
        async (_, next) => {
          events.push("before:pre");
          await next();
          events.push("after:pre");
        },
        { enforce: "pre" },
      );
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
      "before:pre",
      "before:first",
      "before:second",
      "before:post",
      "run:ok",
      "after:post",
      "after:second",
      "after:first",
      "after:pre",
    ]);

    events.length = 0;
    const customRes = await cli.run(["custom-fail"], { terminal });

    expect(customRes.ok).toBeFalsy();
    expect(events).toEqual([
      "before:pre",
      "before:first",
      "before:second",
      "before:post",
      "error:second",
    ]);

    events.length = 0;
    const fallbackRes = await cli.run(["fallback-fail"], { terminal });

    expect(fallbackRes.ok).toBeFalsy();
    expect(events).toEqual([
      "before:pre",
      "before:first",
      "before:second",
      "before:post",
      "error:second",
      "error:first",
    ]);
  });

  it("replaces named plugins atomically on both direct and nested .use()", async () => {
    const terminal = createMemoryTerminal();

    const makeGreetingPlugin = (msg: string) =>
      plugin("demo:greet").command("hi", {
        run(ctx) {
          ctx.terminal.stdout(msg);
        },
      });

    const bundlePlugin = plugin("demo:bundle").use(makeGreetingPlugin("v1"));
    const cli = clerc({ name: "app", version: "1.0.0" })
      .use(bundlePlugin)
      .use(makeGreetingPlugin("v2"));

    await cli.run(["hi"], { terminal });

    expect(terminal.stdoutText()).toBe("v2");
  });

  it("injects typed ctx.state via middleware next({ ... }) with full teardown support", async () => {
    const terminal = createMemoryTerminal();
    const events: string[] = [];

    const configPlugin = plugin("test:config")
      .flags({ config: { type: String, default: "default.json" } })
      .middleware(async (ctx, next) => {
        const loadedConfig = await Promise.resolve(
          `loaded:${ctx.flags.config}`,
        );
        try {
          return await next({ loadedConfig });
        } finally {
          events.push(`cleanup:${loadedConfig}`);
        }
      });

    const cli = createTestBaseCli().use(configPlugin);
    cli.command("deploy", {
      run(ctx) {
        events.push(`run:${ctx.state.loadedConfig}`);
      },
    });

    await cli.run(["deploy"], { terminal });
    await cli.run(["deploy", "--config", "prod.json"], { terminal });

    expect(events).toEqual([
      "run:loaded:default.json",
      "cleanup:loaded:default.json",
      "run:loaded:prod.json",
      "cleanup:loaded:prod.json",
    ]);
    expect(Object.keys(configPlugin)).toEqual(["pluginName"]);
  });
});
