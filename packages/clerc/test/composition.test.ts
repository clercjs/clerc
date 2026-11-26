import { createMemoryTerminal, createTestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import {
  InvalidSchemaError,
  Types,
  UnknownFlagError,
  clerc,
  plugin,
} from "../src";

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

  it("supports flat cli.scope() and subcommand() with isolated flags, rules, middleware, onError, and help", async () => {
    const events: string[] = [];
    const terminal = createMemoryTerminal({
      env: { API_TOKEN: "secret-tok" },
    });

    const cli = clerc({ name: "uptarn", version: "1.0.0" }).groups({
      commands: { admin: "Administration", server: "Server" },
    });

    const admin = cli
      .scope({ group: "admin" })
      .flags({
        server: { type: String, required: true, env: "API_SERVER" },
        token: { type: String, env: "API_TOKEN" },
        tokenFile: { type: String, env: "API_TOKEN_FILE" },
      })
      .rules((r) => [r.oneOf(r.flag("token"), r.flag("tokenFile"))])
      .middleware(async (ctx, next) => {
        events.push(`auth:${ctx.flags.server}:${ctx.flags.token}`);

        return next({ authHeader: `Bearer ${ctx.flags.token}` });
      })
      .onError((err) => {
        events.push(`admin-error:${(err as Error).message}`);

        return (err as Error).message === "handled-by-admin";
      });

    admin.command("status", {
      description: "Show status",
      run(ctx) {
        events.push(`status:${ctx.state.authHeader}`);
      },
    });

    const node = admin
      .subcommand("node", {
        description: "Manage nodes",
        aliases: ["n"],
      })
      .flags({
        format: { type: Types.Enum("table", "wide"), default: "table" },
      });

    node.command("ls", {
      default: true,
      description: "List nodes",
      run(ctx) {
        events.push(`node-ls:${ctx.flags.format}:${ctx.state.authHeader}`);
      },
    });
    node.command("fail", {
      run() {
        throw new Error("handled-by-admin");
      },
    });

    // Runnable subcommand itself with optional positional arg alongside child commands
    const pr = cli
      .subcommand("pr", { description: "Manage pull requests" })
      .flags({ repo: { type: String, short: "R" } });
    pr.command("[id]", {
      run(ctx) {
        events.push(
          `pr-self:${ctx.args.id ?? "none"}:${ctx.flags.repo ?? "-"}`,
        );
      },
    });
    pr.command("ls", {
      run(ctx) {
        events.push(`pr-ls:${ctx.flags.repo ?? "-"}`);
      },
    });

    const server = cli
      .scope({ group: "server" })
      .flags({ db: { type: String, default: "./app.db" } });
    server.command("serve", {
      description: "Start hub",
      run(ctx) {
        events.push(`serve:${ctx.flags.db}`);
      },
    });

    // 1. Admin command gets auth middleware & flags
    await cli.run(["status", "--server", "https://hub.local"], { terminal });
    // 2. Subcommand default: true works with scoped flag between parent & child or directly on parent
    await cli.run(["node", "--server", "https://hub.local"], { terminal });
    await cli.run(
      ["n", "--server", "https://hub.local", "--format", "wide", "ls"],
      {
        terminal,
      },
    );
    // 3. Scoped flag placed between parent & child subcommand
    await cli.run(["pr", "--repo", "org/app", "ls"], { terminal });
    await cli.run(["pr", "42", "-R", "org/app"], { terminal });
    // 4. Sibling scope (server) is isolated from admin required flags & middleware
    await cli.run(["serve"], { terminal });
    // 5. Scoped onError catches admin errors without leaking to server
    const failRes = await cli.run(
      ["node", "fail", "--server", "https://hub.local"],
      {
        terminal,
      },
    );

    expect(failRes.ok).toBeFalsy();
    expect(events).toEqual([
      "auth:https://hub.local:secret-tok",
      "status:Bearer secret-tok",
      "auth:https://hub.local:secret-tok",
      "node-ls:table:Bearer secret-tok",
      "auth:https://hub.local:secret-tok",
      "node-ls:wide:Bearer secret-tok",
      "pr-ls:org/app",
      "pr-self:42:org/app",
      "serve:./app.db",
      "auth:https://hub.local:secret-tok",
      "admin-error:handled-by-admin",
    ]);

    // Server command rejects admin flags
    await expect(
      cli.run(["serve", "--server", "https://hub.local"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(UnknownFlagError);

    // Root --help does NOT leak scoped flags and groups admin commands properly
    terminal.clear();
    await cli.run(["--help"], { terminal });
    const rootHelp = terminal.stdoutText();

    expect(rootHelp).toContain("ADMINISTRATION");
    expect(rootHelp).toContain("SERVER");
    expect(rootHelp).not.toContain("--server");
    expect(rootHelp).not.toContain("--db");

    // Node --help marks ls [default] and shows scoped flags
    terminal.clear();
    await cli.run(["node", "--help"], { terminal });
    const nodeHelp = terminal.stdoutText();

    expect(nodeHelp).toContain("Manage nodes");
    expect(nodeHelp).toContain("[default]");
    expect(nodeHelp).toContain("--format");
    expect(nodeHelp).toContain("--server");

    // Deep scope mutation invalidates cached compilation
    node.command("ping", {
      run() {
        events.push("ping");
      },
    });
    const pingRes = await cli.run(
      ["node", "ping", "--server", "https://hub.local"],
      {
        terminal,
      },
    );

    expect(pingRes.ok).toBeTruthy();
    expect(events.at(-1)).toBe("ping");

    // Subcommand rejects positional arg tokens in its name
    expect(() => cli.subcommand("bad <id>")).toThrow(InvalidSchemaError);
    expect(() => cli.subcommand("   ")).toThrow(InvalidSchemaError);
  });

  it("supports scoped subcommands inside plugins and isolates standalone commands from global flags", async () => {
    const terminal = createMemoryTerminal();
    const dbPlugin = plugin("demo:db");
    const db = dbPlugin
      .subcommand("db", { description: "Database tools" })
      .flags({ url: { type: String, required: true } });
    db.command("migrate", {
      run(ctx) {
        ctx.terminal.stdout(`migrate:${ctx.flags.url}`);
      },
    });

    const cli = createTestBaseCli().flags({ globalOpt: String }).use(dbPlugin);
    cli.command("ping", {
      standalone: true,
      run(ctx) {
        ctx.terminal.stdout("pong");
      },
    });

    await cli.run(["db", "migrate", "--url", "sqlite://local"], { terminal });

    expect(terminal.stdoutText()).toBe("migrate:sqlite://local");

    await expect(
      cli.run(["ping", "--global-opt", "x"], { terminal, throwOnError: true }),
    ).rejects.toThrow(UnknownFlagError);
  });

  it("supports Scope.groups() and Scope.use() with scoped plugins and deduplication", async () => {
    const events: string[] = [];
    const terminal = createMemoryTerminal();

    const makeShared = (tag: string) =>
      plugin("acme:shared").middleware((_ctx, next) =>
        next({ sharedTag: tag }),
      );

    const authPlugin = plugin("acme:auth")
      .use(makeShared("v1"))
      .groups({ flags: { auth: "Auth Options" } })
      .flags({
        token: { type: String, required: true, group: "auth" },
      })
      .middleware((ctx, next) => {
        events.push(`auth:${ctx.flags.token}`);

        return next({ actor: `user:${ctx.flags.token}` });
      })
      .command("whoami", {
        run(ctx) {
          ctx.terminal.stdout(`${ctx.state.actor}:${ctx.state.sharedTag}`);
        },
      });

    const cli = clerc({ name: "app", version: "1.0.0" });
    const admin = cli
      .subcommand("admin", { description: "Admin commands" })
      .groups({ flags: { fields: "Admin Fields" } })
      .use(authPlugin)
      .use(makeShared("v2"));

    admin.command("edit", {
      flags: { name: { type: String, group: "fields" } },
      run(ctx) {
        ctx.terminal.stdout(
          `edit:${ctx.flags.name ?? "-"}:${ctx.state.actor}:${ctx.state.sharedTag}`,
        );
      },
    });
    cli.command("public", {
      run(ctx) {
        ctx.terminal.stdout("public");
      },
    });

    await cli.run(["admin", "whoami", "--token", "sec"], { terminal });

    expect(terminal.stdoutText()).toBe("user:sec:v2");

    terminal.clear();
    await cli.run(["admin", "edit", "--token", "sec", "--name", "web"], {
      terminal,
    });

    expect(terminal.stdoutText()).toBe("edit:web:user:sec:v2");

    // Sibling root command is isolated from admin's mounted plugin
    terminal.clear();
    await cli.run(["public"], { terminal });

    expect(terminal.stdoutText()).toBe("public");
    await expect(
      cli.run(["public", "--token", "sec"], { terminal, throwOnError: true }),
    ).rejects.toThrow(UnknownFlagError);

    // Help renders both Scope.groups() and mounted plugin groups
    terminal.clear();
    await cli.run(["admin", "edit", "--help"], { terminal });
    const editHelp = terminal.stdoutText();

    expect(editHelp).toContain("ADMIN FIELDS");
    expect(editHelp).toContain("AUTH OPTIONS");
  });
});
