import { cli, command } from "clerc";

import type { PlaygroundScenario } from "../.vitepress/playground/runtime.ts";

export const signature: PlaygroundScenario = {
  createCli: () =>
    cli({
      name: "acme",
      version: "2.0.0",
      commands: [
        command("copy <source-path> [dest-path] [extra-files...]", {
          description: "Copy files into destination",
          args: {
            sourcePath: { description: "Source file" },
            destPath: { default: "./dist", description: "Destination dir" },
            extraFiles: { description: "Additional files" },
          },
          run({ args, log }) {
            log.info("Resolved ctx.args", args);
          },
        }),
      ],
    }),
  presets: [
    { cmd: "copy src/index.ts" },
    { cmd: "copy src/index.ts out a.ts b.ts" },
    { cmd: "copy --help" },
  ],
};

export const envFallback: PlaygroundScenario = {
  createCli: () =>
    cli({
      name: "acme",
      version: "2.0.0",
      commands: [
        command("deploy <token> [region]", {
          description: "Deploy using token arg or DEPLOY_TOKEN",
          args: {
            token: { env: "DEPLOY_TOKEN", description: "API token" },
            region: { default: "us-east-1", description: "Target region" },
          },
          run({ args, log }) {
            log.success(
              `Authenticated (${args.region})`,
              `token=${args.token}`,
            );
          },
        }),
      ],
    }),
  presets: [
    { cmd: "deploy" },
    { cmd: "deploy tok_live_99 eu-west-1" },
    { cmd: "deploy --help" },
  ],
};

export const doubleDash: PlaygroundScenario = {
  createCli: () =>
    cli({
      name: "acme",
      version: "2.0.0",
      commands: [
        command("run <script> -- [pass-through...]", {
          description: "Run package script with passthrough args",
          run({ args, raw, log }) {
            log.step(`Running script '${args.script}'`, {
              passThrough: args.passThrough,
              doubleDash: raw.doubleDash,
            });
          },
        }),
      ],
    }),
  presets: [
    { cmd: "run test -- --watch --bail" },
    { cmd: "run build -- --sourcemap" },
  ],
};
