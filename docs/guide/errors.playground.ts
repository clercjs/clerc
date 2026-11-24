import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import {
  ClercError,
  clerc,
} from "../.vitepress/components/playground-runtime.ts";

const scenario: PlaygroundScenario = {
  createCli: () =>
    clerc({
      name: "acme",
      version: "2.0.0",
      description: "Build and publish packages",
    })
      .flags({
        json: { type: Boolean, description: "Serialize errors as JSON" },
      })
      .middleware(
        (ctx, next) => {
          if (ctx.flags.json) {
            ctx.log.format = "json";
          }

          return next();
        },
        { enforce: "pre" },
      )
      .command("build <entry>", {
        description: "Compile source files",
        flags: {
          output: { type: String, short: "o", description: "Output directory" },
        },
        run({ args, flags, log }) {
          log.success(`Compiled ${args.entry} -> ${flags.output ?? "dist"}`);
        },
      })
      .command("publish", {
        description: "Publish package to registry",
        run({ flags, log }) {
          if (flags.json) {
            log.format = "json";
          }

          throw new ClercError("not logged in to registry", {
            code: "ERR_VALIDATION",
            detail: "No token found in ~/.acmerc or ACME_TOKEN",
            usage: "acme login --registry https://registry.acme.dev",
          }).addHint("run 'acme login' first or set ACME_TOKEN");
        },
      }),
  source: `cli.command("publish", {
  run() {
    throw new ClercError("not logged in to registry", {
      code: "ERR_VALIDATION",
      detail: "No token found in ~/.acmerc or ACME_TOKEN",
      usage: "acme login --registry https://registry.acme.dev",
    }).addHint("run 'acme login' first or set ACME_TOKEN");
  },
});`,
  presets: [
    { cmd: "buid src/index.ts" },
    { cmd: "build src/index.ts --outpt dist" },
    { cmd: "publish" },
    { cmd: "publish --json" },
  ],
};

export default scenario;
