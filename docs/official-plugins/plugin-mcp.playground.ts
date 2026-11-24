import { createMcpHandler } from "../../packages/plugin-mcp/src/protocol.ts";
import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import { Types, clerc } from "../.vitepress/components/playground-runtime.ts";

export const mcpRpc: PlaygroundScenario = {
  createCli: () => {
    const app = clerc({
      name: "acme",
      version: "2.0.0",
      description: "Manage Acme deployments and cluster health",
    })
      .command("deploy <env>", {
        description: "Deploy service to target environment",
        args: { env: Types.Enum("staging", "prod") },
        flags: {
          dryRun: { type: Boolean, description: "Preview without deploying" },
        },
        meta: { mcp: { destructive: true } },
        run({ args, flags, log }) {
          log.info(`Deployed ${args.env} (dryRun=${String(flags.dryRun)})`);
        },
      })
      .command("status", {
        description: "Check cluster health",
        meta: { mcp: { readOnly: true, idempotent: true } },
        run({ terminal }) {
          terminal.stdout("cluster=healthy latency=14ms");
        },
      });

    const handler = createMcpHandler({
      model: app.buildModel(),
      run: (argv, opts) => app.run(argv, opts),
    });

    return app.command("rpc <method> [target]", {
      description: "Send a live JSON-RPC 2.0 request to @clerc/plugin-mcp",
      args: {
        method: Types.Enum(
          "tools/list",
          "tools/call",
          "resources/list",
          "resources/read",
        ),
        target: { description: "Tool name or resource URI" },
      },
      flags: {
        env: { type: Types.Enum("staging", "prod"), default: "prod" },
        dryRun: { type: Boolean, default: true },
      },
      async run({ args, flags, terminal }) {
        const params =
          args.method === "tools/call"
            ? {
                name: args.target ?? "deploy",
                arguments:
                  (args.target ?? "deploy") === "deploy"
                    ? { env: flags.env, dryRun: flags.dryRun }
                    : {},
              }
            : args.method === "resources/read"
              ? { uri: args.target ?? "clerc://help/deploy" }
              : {};
        const res = await handler({
          jsonrpc: "2.0",
          id: 1,
          method: args.method,
          params,
        });
        terminal.stdout(JSON.stringify(res?.result ?? res, null, 2));
      },
    });
  },
  presets: [
    { cmd: "rpc tools/list" },
    { cmd: "rpc tools/call deploy --env prod --dry-run" },
    { cmd: "rpc tools/call status" },
    { cmd: "rpc resources/list" },
    { cmd: "rpc resources/read clerc://help/deploy" },
  ],
};
