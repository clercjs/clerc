import { createMemoryTerminal, createTestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import {
  InvalidSchemaError,
  Types,
  UnknownFlagError,
  cli,
  command,
  group,
  middleware,
  oneOf,
  use,
} from "../src";

describe("Combinator composition (cli, command, middleware, group, use)", () => {
  it("runs middlewares in lexical onion order and onError in reverse (LIFO) order", async () => {
    const events: string[] = [];
    const terminal = createMemoryTerminal();

    const outer = middleware({
      async run(_, next) {
        events.push("before:outer");
        await next();
        events.push("after:outer");
      },
      onError() {
        events.push("error:outer");

        return true;
      },
    });

    const inner = middleware({
      async run(_, next) {
        events.push("before:inner");
        await next();
        events.push("after:inner");
      },
      onError(err) {
        events.push("error:inner");

        return err instanceof Error && err.message === "custom";
      },
    });

    const leafWrap = middleware(async (_, next) => {
      events.push("before:leaf");
      await next();
      events.push("after:leaf");
    });

    const app = createTestBaseCli({
      use: [outer, inner],
      onError() {
        events.push("error:cli");

        return true;
      },
      commands: [
        command("ok", {
          use: [leafWrap],
          run() {
            events.push("run:ok");
          },
        }),
        command("custom-fail", {
          use: [leafWrap],
          run() {
            throw new Error("custom");
          },
        }),
        command("fallback-fail", {
          use: [leafWrap],
          run() {
            throw new Error("other");
          },
        }),
      ],
    });

    await app.run(["ok"], { terminal });

    expect(events).toEqual([
      "before:outer",
      "before:inner",
      "before:leaf",
      "run:ok",
      "after:leaf",
      "after:inner",
      "after:outer",
    ]);

    events.length = 0;
    const customRes = await app.run(["custom-fail"], { terminal });

    expect(customRes.ok).toBeFalsy();
    expect(events).toEqual([
      "before:outer",
      "before:inner",
      "before:leaf",
      "error:inner",
    ]);

    events.length = 0;
    const fallbackRes = await app.run(["fallback-fail"], { terminal });

    expect(fallbackRes.ok).toBeFalsy();
    expect(events).toEqual([
      "before:outer",
      "before:inner",
      "before:leaf",
      "error:inner",
      "error:outer",
    ]);
  });

  it("injects typed ctx.state via middleware setup() and cleans up in sibling run() try/finally", async () => {
    const terminal = createMemoryTerminal();
    const events: string[] = [];

    const withDb = middleware({
      flags: { dbUrl: { type: String, default: "sqlite://default.db" } },
      async setup(ctx) {
        const db = {
          url: ctx.flags.dbUrl,
          async close() {
            events.push(`close:${ctx.flags.dbUrl}`);
          },
        };
        events.push(`open:${db.url}`);

        return { db };
      },
      async run(ctx, next) {
        try {
          await next();
        } finally {
          await ctx.state.db.close();
        }
      },
    });

    const app = createTestBaseCli({
      use: [withDb],
      commands: [
        command("deploy", {
          use: [withDb],
          run(ctx) {
            events.push(`run:${ctx.state.db.url}`);
          },
        }),
      ],
    });

    await app.run(["deploy"], { terminal });
    await app.run(["deploy", "--db-url", "sqlite://prod.db"], { terminal });

    expect(events).toEqual([
      "open:sqlite://default.db",
      "run:sqlite://default.db",
      "close:sqlite://default.db",
      "open:sqlite://prod.db",
      "run:sqlite://prod.db",
      "close:sqlite://prod.db",
    ]);
  });

  it("supports lexical scoping via use() and group(), reference deduplication, default subcommands, and runnable parent commands", async () => {
    const events: string[] = [];
    const terminal = createMemoryTerminal({
      env: { API_TOKEN: "secret-tok" },
    });

    const globalConfig = middleware({
      flags: { config: { type: String, default: "uptarn.toml" } },
      setup(ctx) {
        events.push(`cfg:${ctx.flags.config}`);

        return { configPath: ctx.flags.config };
      },
    });

    const hubAuth = middleware({
      use: [globalConfig],
      flags: group("Connection & Auth", [
        { server: { type: String, required: true, env: "API_SERVER" } },
        oneOf(
          { token: { type: String, required: true, env: "API_TOKEN" } },
          {
            tokenFile: {
              type: String,
              required: true,
              env: "API_TOKEN_FILE",
            },
          },
        ),
      ]),
      setup(ctx) {
        const tok = ctx.flags.token ?? `file:${ctx.flags.tokenFile}`;
        events.push(`auth:${ctx.flags.server}:${tok}`);

        return { authHeader: `Bearer ${tok}` };
      },
      onError(err) {
        events.push(`admin-error:${(err as Error).message}`);

        return (err as Error).message === "handled-by-admin";
      },
    });

    const status = command("status", {
      use: [hubAuth],
      description: "Show status",
      run(ctx) {
        events.push(`status:${ctx.state.authHeader}:${ctx.state.configPath}`);
      },
    });

    const nodeLs = command("ls", {
      use: [hubAuth],
      description: "List nodes",
      flags: {
        format: { type: Types.Enum("table", "wide"), default: "table" },
      },
      run(ctx) {
        events.push(
          `node-ls:${ctx.flags.format}:${ctx.state.authHeader}:${ctx.state.configPath}`,
        );
      },
    });

    const nodeFail = command("fail", {
      use: [hubAuth],
      run() {
        throw new Error("handled-by-admin");
      },
    });

    const node = command("node", {
      aliases: ["n"],
      description: "Manage nodes",
      commands: [nodeLs, nodeFail],
      default: nodeLs,
    });

    const repoFlags = { repo: { type: String, short: "R" } };
    const prLs = command("ls", {
      flags: repoFlags,
      run(ctx) {
        events.push(`pr-ls:${ctx.flags.repo ?? "-"}`);
      },
    });
    const pr = command("pr [id]", {
      description: "Manage pull requests",
      flags: repoFlags,
      commands: [prLs],
      run(ctx) {
        events.push(
          `pr-self:${ctx.args.id ?? "none"}:${ctx.flags.repo ?? "-"}`,
        );
      },
    });

    const serve = command("serve", {
      description: "Start hub",
      flags: { db: { type: String, default: "./app.db" } },
      run(ctx) {
        events.push(`serve:${ctx.flags.db}`);
      },
    });

    const app = cli({
      name: "uptarn",
      version: "1.0.0",
      use: [globalConfig],
      commands: [
        group("Administration", use([hubAuth], [status, node])),
        pr,
        group("Server", [serve]),
      ],
    });

    // 1. Admin command runs globalConfig + hubAuth once despite multiple .use references
    await app.run(["status", "--server", "https://hub.local"], { terminal });
    // 2. Default subcommand works on bare namespace and with leading flags
    await app.run(["node", "--server", "https://hub.local"], { terminal });
    await app.run(
      ["n", "--server", "https://hub.local", "--format", "wide", "ls"],
      { terminal },
    );
    // 3. Runnable parent command + subcommand
    await app.run(["pr", "--repo", "org/app", "ls"], { terminal });
    await app.run(["pr", "42", "-R", "org/app"], { terminal });
    // 4. Sibling command outside use([hubAuth], ...) is completely isolated
    await app.run(["serve"], { terminal });
    // 5. Scoped middleware onError catches admin error
    const failRes = await app.run(
      ["node", "fail", "--server", "https://hub.local"],
      { terminal },
    );

    expect(failRes.ok).toBeFalsy();
    expect(events).toEqual([
      "cfg:uptarn.toml",
      "auth:https://hub.local:secret-tok",
      "status:Bearer secret-tok:uptarn.toml",
      "cfg:uptarn.toml",
      "auth:https://hub.local:secret-tok",
      "node-ls:table:Bearer secret-tok:uptarn.toml",
      "cfg:uptarn.toml",
      "auth:https://hub.local:secret-tok",
      "node-ls:wide:Bearer secret-tok:uptarn.toml",
      "cfg:uptarn.toml",
      "pr-ls:org/app",
      "cfg:uptarn.toml",
      "pr-self:42:org/app",
      "cfg:uptarn.toml",
      "serve:./app.db",
      "cfg:uptarn.toml",
      "auth:https://hub.local:secret-tok",
      "admin-error:handled-by-admin",
    ]);

    // Serve command rejects admin flags
    await expect(
      app.run(["serve", "--server", "https://hub.local"], {
        terminal,
        throwOnError: true,
      }),
    ).rejects.toThrow(UnknownFlagError);

    // Root --help does NOT leak scoped flags and groups commands cleanly
    terminal.clear();
    await app.run(["--help"], { terminal });
    const rootHelp = terminal.stdoutText();

    expect(rootHelp).toContain("ADMINISTRATION");
    expect(rootHelp).toContain("SERVER");
    expect(rootHelp).not.toContain("--server");
    expect(rootHelp).not.toContain("--db");

    // Node --help marks ls [default] and shows scoped flags without leaking ADMINISTRATION group
    terminal.clear();
    await app.run(["node", "--help"], { terminal });
    const nodeHelp = terminal.stdoutText();

    expect(nodeHelp).toContain("Manage nodes");
    expect(nodeHelp).toContain("[default]");
    expect(nodeHelp).toContain("CONNECTION & AUTH");
    expect(nodeHelp).toContain("--server");
    expect(nodeHelp).not.toContain("ADMINISTRATION");

    // Validation guards
    expect(() => cli({ name: "   " })).toThrow(InvalidSchemaError);
    expect(() => group("   ", [serve])).toThrow(InvalidSchemaError);
  });
});
