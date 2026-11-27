import { PassThrough } from "node:stream";

import { createMemoryTerminal, createTestCli } from "@clerc/test-utils";
import {
  Types,
  command,
  exclusive,
  group,
  middleware,
  oneOf,
  together,
  use,
} from "clerc";
import { describe, expect, it } from "vitest";

import { createMcpHandler, listMcpResources, listMcpTools, mcp } from "../src";

describe("@clerc/plugin-mcp", () => {
  it("generates typed JSON Schemas from args, flags, Types.*, Standard JSON Schema, and meta.mcp", () => {
    const emailStandardJsonSchema = {
      "~standard": {
        version: 1 as const,
        vendor: "mock-zod",
        validate: (v: unknown) => ({ value: String(v) }),
        jsonSchema: {
          input: () => ({
            $schema: "https://json-schema.org/draft/2020-12/schema",
            type: "string",
            format: "email",
          }),
        },
      },
    };

    const app = createTestCli({
      flags: {
        verbose: {
          type: Types.Counter,
          short: "v",
          description: "Verbosity level",
        },
      },
      commands: [
        mcp(),
        command("deploy <env> [files...]", {
          description: "Deploy application",
          args: {
            env: {
              type: Types.Enum("staging", "prod"),
              description: "Target environment",
            },
          },
          flags: {
            port: {
              type: Types.Integer({ min: 1, max: 65_535 }),
              default: 3000,
              description: "Server port",
            },
            dryRun: { type: Boolean, description: "Preview only" },
            notify: { type: emailStandardJsonSchema, required: true },
            secret: { type: String, hidden: true },
          },
          meta: {
            mcp: { destructive: true },
          },
          run() {},
        }),
        command("db migrate", {
          description: "Run migrations",
          meta: { mcp: { readOnly: false, idempotent: true } },
          run() {},
        }),
        command("internal", { hidden: true, run() {} }),
        command("skipped", { meta: { mcp: { enabled: false } }, run() {} }),
      ],
    });

    const tools = listMcpTools(app.buildModel());

    expect(tools.map((t) => t.name)).toEqual(["deploy", "db_migrate"]);

    const deployTool = tools[0];

    expect(deployTool.annotations).toEqual({ destructiveHint: true });
    expect(deployTool.inputSchema.required).toEqual(["env", "notify"]);
    expect(deployTool.inputSchema.properties).toMatchObject({
      env: {
        type: "string",
        enum: ["staging", "prod"],
        description: "Target environment",
      },
      files: {
        type: "array",
        items: { type: "string" },
      },
      port: {
        type: "integer",
        minimum: 1,
        maximum: 65_535,
        default: 3000,
        description: "Server port",
      },
      dryRun: { type: "boolean", description: "Preview only" },
      notify: { type: "string", format: "email" },
      verbose: { type: "integer", minimum: 0, description: "Verbosity level" },
    });
    expect(deployTool.inputSchema.properties).not.toHaveProperty("secret");
    expect(deployTool.inputSchema.properties).not.toHaveProperty("help");
    expect(deployTool.inputSchema.properties).not.toHaveProperty("version");
  });

  it("executes commands via tools/call through full state middleware + validation pipeline", async () => {
    const authMw = middleware({
      flags: { token: { type: String, default: "guest" } },
      async setup(ctx) {
        return {
          actor: await Promise.resolve(`user:${ctx.flags.token}`),
        };
      },
      async run(ctx, next) {
        ctx.terminal.stdout(`actor=${ctx.state.actor}`);
        await next();
      },
    });

    const app = createTestCli({
      use: [authMw],
      commands: [
        mcp(),
        command("release <channel> -- [extra...]", {
          use: [authMw],
          description: "Publish release",
          args: { channel: Types.Enum("alpha", "beta") },
          flags: {
            tags: { type: String, multiple: true },
            dryRun: Boolean,
            strict: { type: Boolean, default: true, negatable: false },
          },
          run(ctx) {
            ctx.terminal.stdout(
              `released ${ctx.args.channel} dry=${ctx.flags.dryRun} strict=${ctx.flags.strict} tags=${ctx.flags.tags.join(",")} extra=${ctx.args.extra.join(",")}`,
            );
          },
        }),
      ],
    });

    const handler = createMcpHandler({
      model: app.buildModel(),
      run: (argv, opts) => app.run(argv, opts),
    });

    const init = await handler({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26" },
    });

    expect(init?.result).toMatchObject({
      protocolVersion: "2025-03-26",
      serverInfo: { name: "test", version: "1.0.0" },
      capabilities: { tools: {}, resources: {} },
    });

    const notification = await handler({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    expect(notification).toBeNull();

    const okCall = await handler({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "release",
        arguments: {
          channel: "beta",
          token: "ray",
          dryRun: true,
          strict: false,
          tags: ["v2", "latest"],
          extra: ["--force"],
        },
      },
    });

    expect(okCall?.result).toMatchObject({
      content: [
        {
          type: "text",
          text: expect.stringContaining(
            "released beta dry=true strict=false tags=v2,latest extra=--force",
          ),
        },
      ],
    });
    expect((okCall?.result as any).content[0].text).toContain("actor=user:ray");
    expect((okCall?.result as any).isError).toBeUndefined();

    const invalidCall = await handler({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "release",
        arguments: { channel: "invalid" },
      },
    });

    expect(invalidCall?.result).toMatchObject({
      isError: true,
      content: [
        {
          type: "text",
          text: expect.stringContaining("expected one of: 'alpha', 'beta'"),
        },
      ],
    });
  });

  it("exposes ANSI-free CLI overview and command help pages as MCP resources", async () => {
    const app = createTestCli({
      commands: [
        mcp(),
        command("db migrate", {
          description: "Run database migrations",
          flags: { force: { type: Boolean, description: "Skip prompt" } },
          run() {},
        }),
      ],
    });

    const resources = listMcpResources(app.buildModel());

    expect(resources.map((r) => r.uri)).toEqual([
      "cli://test/help",
      "cli://test/commands/db/migrate",
    ]);

    const handler = createMcpHandler({
      model: app.buildModel(),
      run: (argv, opts) => app.run(argv, opts),
    });

    const rootHelp = await handler({
      jsonrpc: "2.0",
      id: 1,
      method: "resources/read",
      params: { uri: "cli://test/help" },
    });

    expect((rootHelp?.result as any).contents[0]).toMatchObject({
      uri: "cli://test/help",
      mimeType: "text/plain",
      text: expect.stringContaining("test v1.0.0\nTest CLI"),
    });

    const cmdHelp = await handler({
      jsonrpc: "2.0",
      id: 2,
      method: "resources/read",
      params: { uri: "cli://test/commands/db/migrate" },
    });

    expect((cmdHelp?.result as any).contents[0].text).toContain(
      "test db migrate v1.0.0\nRun database migrations",
    );
    expect((cmdHelp?.result as any).contents[0].text).toContain("--force");
  });

  it("serves newline-delimited JSON-RPC over stdio when invoked as 'mcp' command", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (chunk) => chunks.push(chunk.toString("utf8")));

    const terminal = createMemoryTerminal();
    const app = createTestCli({
      commands: [
        mcp({ input, output }),
        command("greet <name>", {
          description: "Greet someone",
          run(ctx) {
            ctx.terminal.stdout(`Hello, ${ctx.args.name}!`);
          },
        }),
      ],
    });

    const runPromise = app.run(["mcp"], { terminal });

    input.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" })}\n`,
    );
    input.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "greet", arguments: { name: "MCP" } } })}\n`,
    );
    input.end();

    const res = await runPromise;

    expect(res.ok).toBeTruthy();
    expect(terminal.stdoutText()).toBe("");

    const responses = chunks
      .join("")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));

    expect(responses).toHaveLength(2);
    expect(responses[0]).toEqual({ jsonrpc: "2.0", id: 1, result: {} });
    expect(responses[1].result.content[0].text).toContain("Hello, MCP!");
  });

  it("handles dash-prefixed positional args safely, exports combinator constraints, and rejects duplicate MCP tool names", async () => {
    const app = createTestCli({
      commands: [
        mcp(),
        command("echo <text>", {
          flags: { prefix: { type: String } },
          run(ctx) {
            ctx.terminal.stdout(
              ctx.flags.prefix
                ? `${ctx.flags.prefix}:${ctx.args.text}`
                : ctx.args.text,
            );
          },
        }),
      ],
    });

    const handler = createMcpHandler({
      model: app.buildModel(),
      run: (argv, opts) => app.run(argv, opts),
    });

    const res = await handler({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "echo",
        arguments: { prefix: "-v", text: "--not-a-flag" },
      },
    });

    expect((res?.result as any).content[0].text).toBe("-v:--not-a-flag");
    expect((res?.result as any).isError).toBeUndefined();

    const dupCli = createTestCli({
      commands: [
        command("db migrate", { run() {} }),
        command("db_migrate", { run() {} }),
      ],
    });

    const rulesCli = createTestCli({
      commands: [
        command("serve", {
          flags: [
            exclusive({ json: Boolean }, { yaml: Boolean }),
            together({ tlsKey: String, tlsCert: String }),
            oneOf({ token: String }, { tokenFile: String }),
          ],
          run() {},
        }),
      ],
    });
    const [serveTool] = listMcpTools(rulesCli.buildModel());

    expect(serveTool.inputSchema.dependentRequired).toEqual({
      tlsKey: ["tlsCert"],
      tlsCert: ["tlsKey"],
    });
    expect(serveTool.inputSchema.allOf).toEqual([
      { not: { required: ["json", "yaml"] } },
      { anyOf: [{ required: ["token"] }, { required: ["tokenFile"] }] },
      { not: { required: ["token", "tokenFile"] } },
    ]);

    expect(() => listMcpTools(dupCli.buildModel())).toThrow(
      "Duplicate MCP tool name: 'db_migrate'",
    );
  });

  it("exports scoped middleware flags, constraints, and array bounds (uniqueItems/minItems/maxItems) into MCP schemas", () => {
    const adminAuth = middleware({
      flags: oneOf(
        { token: { type: String, description: "API token" } },
        { tokenFile: { type: String, description: "Token file" } },
      ),
    });

    const node = command("node", {
      description: "Manage nodes",
      commands: [
        command("order <ids...>", {
          description: "Order nodes",
          args: {
            ids: { unique: true, minItems: 1, maxItems: 10 },
          },
          flags: {
            tags: {
              type: String,
              multiple: true,
              unique: true,
              minItems: 1,
              maxItems: 5,
            },
          },
          run() {},
        }),
      ],
    });

    const serve = command("serve", {
      description: "Start server",
      flags: { db: String },
      run() {},
    });

    const app = createTestCli({
      commands: [
        mcp(),
        group("Admin", use([adminAuth], [node])),
        group("Server", [serve]),
      ],
    });

    const tools = listMcpTools(app.buildModel());
    const orderTool = tools.find((t) => t.name === "node_order")!;
    const serveTool = tools.find((t) => t.name === "serve")!;

    expect(orderTool.inputSchema.properties.ids).toMatchObject({
      type: "array",
      items: { type: "string" },
      uniqueItems: true,
      minItems: 1,
      maxItems: 10,
    });
    expect(orderTool.inputSchema.properties.tags).toMatchObject({
      type: "array",
      items: { type: "string" },
      uniqueItems: true,
      minItems: 1,
      maxItems: 5,
    });
    expect(orderTool.inputSchema.properties.token).toBeDefined();
    expect(orderTool.inputSchema.properties.db).toBeUndefined();
    expect(orderTool.inputSchema.allOf).toBeDefined();

    expect(serveTool.inputSchema.properties.db).toBeDefined();
    expect(serveTool.inputSchema.properties.token).toBeUndefined();
    expect(serveTool.inputSchema.allOf).toBeUndefined();
  });

  it("handles optional positional dependencies, arg/flag collisions, implicitValue flags, and ctx.exit()", async () => {
    const app = createTestCli({
      commands: [
        mcp(),
        command("deploy [env] [region] [zone]", {
          run(ctx) {
            ctx.terminal.stdout(
              `env=${ctx.args.env ?? "-"} region=${ctx.args.region ?? "-"} zone=${ctx.args.zone ?? "-"}`,
            );
          },
        }),
        command("copy [target]", {
          flags: {
            target: { type: String, description: "Target flag" },
            inspect: {
              type: Number,
              implicitValue: 9229,
              description: "Enable inspector",
            },
          },
          run(ctx) {
            ctx.terminal.stdout(
              `arg=${ctx.args.target ?? "-"} flag=${ctx.flags.target ?? "-"} inspect=${ctx.flags.inspect ?? "-"}`,
            );
          },
        }),
        command("check", {
          run(ctx) {
            ctx.log.warn("needs formatting");
            ctx.exit(1);
          },
        }),
      ],
    });

    const tools = listMcpTools(app.buildModel());
    const deployTool = tools.find((t) => t.name === "deploy")!;
    const copyTool = tools.find((t) => t.name === "copy")!;

    expect(deployTool.inputSchema.dependentRequired).toEqual({
      region: ["env"],
      zone: ["env", "region"],
    });
    expect(copyTool.inputSchema.properties.target).toEqual({ type: "string" });
    expect(copyTool.inputSchema.properties.flag_target).toEqual({
      type: "string",
      description: "Target flag",
    });
    expect(copyTool.inputSchema.properties.inspect).toEqual({
      anyOf: [{ type: "boolean" }, { type: "number" }],
      description: "Enable inspector",
    });

    const handler = createMcpHandler({
      model: app.buildModel(),
      run: (argv, opts) => app.run(argv, opts),
    });

    const skippedRes = await handler({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "deploy", arguments: { region: "eu-west-1" } },
    });

    expect(skippedRes?.error).toEqual({
      code: -32_602,
      message:
        "Cannot provide positional argument 'region' without preceding argument 'env'",
    });

    const implicitTrueRes = await handler({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "copy",
        arguments: { flag_target: "dist", inspect: true },
      },
    });

    expect((implicitTrueRes?.result as any).content[0].text).toBe(
      "arg=- flag=dist inspect=9229",
    );

    const implicitFalseRes = await handler({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "copy",
        arguments: { target: "src", inspect: false },
      },
    });

    expect((implicitFalseRes?.result as any).content[0].text).toBe(
      "arg=src flag=- inspect=-",
    );

    const implicitNumRes = await handler({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "copy",
        arguments: { inspect: 9230 },
      },
    });

    expect((implicitNumRes?.result as any).content[0].text).toBe(
      "arg=- flag=- inspect=9230",
    );

    const exitRes = await handler({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "check", arguments: {} },
    });

    expect(exitRes?.result).toEqual({
      content: [{ type: "text", text: " warn needs formatting" }],
      isError: true,
    });
  });
});
