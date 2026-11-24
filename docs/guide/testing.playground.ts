import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import { Types, clerc } from "../.vitepress/components/playground-runtime.ts";

const scenario: PlaygroundScenario = {
  env: { ACME_TOKEN: "secret_123" },
  createCli: () => {
    const cli = clerc({
      name: "acme",
      version: "2.0.0",
      description: "In-memory testable CLI (env: ACME_TOKEN=secret_123)",
    })
      .command("deploy <env>", {
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
      })
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
      });

    return cli;
  },
  source: `const terminal = createMemoryTerminal({
  env: { ACME_TOKEN: "secret_123" },
});

const ok = await cli.run(["deploy", "staging"], { terminal });
// ok.exitCode === 0, terminal.stdoutText() captured in memory

const bad = await cli.run(["deploy", "qa"], { terminal });
// bad.exitCode === 2, no process.exit() called`,
  presets: [
    { cmd: "deploy staging" },
    { cmd: "deploy qa" },
    { cmd: "inspect-model" },
    { cmd: "deploy --help" },
  ],
};

export default scenario;
