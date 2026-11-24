import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import { Types, clerc } from "../.vitepress/components/playground-runtime.ts";

export const memoryTerminal: PlaygroundScenario = {
  env: { ACME_TOKEN: "secret_123" },
  createCli: () =>
    clerc({
      name: "acme",
      version: "2.0.0",
      description: "In-memory testable CLI (env: ACME_TOKEN=secret_123)",
    }).command("deploy <env>", {
      description: "Deploy using ACME_TOKEN from MemoryTerminal env",
      args: { env: Types.Enum("staging", "prod") },
      flags: {
        token: { type: String, required: true, env: "ACME_TOKEN" },
      },
      run({ args, flags, log }) {
        log.success(
          `Deployed to ${args.env}`,
          `token=${flags.token.slice(0, 6)}***`,
        );
      },
    }),
  presets: [
    { cmd: "deploy staging" },
    { cmd: "deploy qa" },
    { cmd: "deploy --help" },
  ],
};

export const inspectModel: PlaygroundScenario = {
  createCli: () =>
    clerc({ name: "acme", version: "2.0.0" })
      .command("build", { description: "Build project", run() {} })
      .command("inspect-model", {
        description: "Inspect immutable cli.buildModel() metadata",
        run({ model, log }) {
          const commands = model.tree
            .listVisibleChildren(model.tree.root)
            .map((c) => c.name);
          log.info("Compiled CliModel", {
            name: model.meta.name,
            version: model.meta.version,
            commands,
          });
        },
      }),
  presets: [{ cmd: "inspect-model" }],
};
