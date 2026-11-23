# @clerc/plugin-mcp

Expose any Clerc v2 CLI as a zero-dependency **Model Context Protocol (MCP)** stdio server — turning every CLI command into a typed MCP tool and every help page into an MCP resource.

## Usage

```ts
import { mcpPlugin } from "@clerc/plugin-mcp";
import { Types, clerc } from "clerc";

const cli = clerc({
  scriptName: "acme",
  version: "2.0.0",
  description: "Build and deploy apps",
}).use(mcpPlugin());

cli.command("deploy <env>", {
  description: "Deploy application",
  args: { env: Types.Enum("staging", "prod") },
  flags: {
    dryRun: { type: Boolean, description: "Preview without deploying" },
  },
  run(ctx) {
    ctx.terminal.stdout(`Deployed to ${ctx.args.env}`);
  },
});

await cli.runMain();
```

Start the MCP server over stdio:

```sh
acme mcp
```
