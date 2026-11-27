# @clerc/plugin-mcp

Expose any Clerc v2 CLI as a zero-dependency **Model Context Protocol (MCP)** stdio server - turning every CLI command into a typed MCP tool and every help page into an MCP resource.

## Usage

```ts
import { mcp } from "@clerc/plugin-mcp";
import { Types, cli, command } from "clerc";

const deploy = command("deploy <env>", {
  description: "Deploy application",
  args: { env: Types.Enum("staging", "prod") },
  flags: {
    dryRun: { type: Boolean, description: "Preview without deploying" },
  },
  run(ctx) {
    ctx.terminal.stdout(`Deployed to ${ctx.args.env}`);
  },
});

const app = cli({
  name: "acme",
  version: "2.0.0",
  description: "Build and deploy apps",
  commands: [deploy, mcp()],
});

await app.runMain();
```

Start the MCP server over stdio:

```sh
acme mcp
```
