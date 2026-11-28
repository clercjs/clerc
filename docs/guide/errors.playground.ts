import { ClercError, cli, command } from "clerc";

import type { PlaygroundScenario } from "../.vitepress/playground/runtime.ts";

export const typoSuggestions: PlaygroundScenario = {
  createCli: () =>
    cli({
      name: "acme",
      version: "2.0.0",
      commands: [
        command("build <entry>", {
          description: "Compile source files",
          flags: {
            output: {
              type: String,
              short: "o",
              description: "Output directory",
            },
          },
          run({ args, flags, log }) {
            log.success(`Compiled ${args.entry} -> ${flags.output ?? "dist"}`);
          },
        }),
      ],
    }),
  presets: [
    { cmd: "buid src/index.ts" },
    { cmd: "build src/index.ts --outpt dist" },
  ],
};

export const clercError: PlaygroundScenario = {
  createCli: () =>
    cli({
      name: "acme",
      version: "2.0.0",
      commands: [
        command("publish", {
          description: "Publish package to registry",
          run() {
            throw new ClercError("not logged in to registry", {
              code: "ERR_AUTH",
              detail: "No token found in ~/.acmerc or ACME_TOKEN",
              usage: "acme login --registry https://registry.acme.dev",
            }).addHint("run 'acme login' first or set ACME_TOKEN");
          },
        }),
      ],
    }),
  presets: [{ cmd: "publish" }],
};
