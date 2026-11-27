import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import {
  Types,
  cli,
  command,
  completions,
} from "../.vitepress/components/playground-runtime.ts";

export const dynamicCompletions: PlaygroundScenario = {
  createCli: () =>
    cli({
      name: "acme",
      version: "2.0.0",
      commands: [
        command("deploy <env> [service]", {
          aliases: ["d"],
          description: "Deploy application with context-aware completions",
          args: {
            env: {
              type: Types.Enum("staging", "prod"),
              description: "Target environment",
            },
            service: {
              description: "Service worker name",
              async complete({ args, flags }) {
                const target = (args.env as string | undefined) ?? "staging";
                const region =
                  (flags.region as string | undefined) ?? "us-east-1";

                return [
                  {
                    value: `${target}-api`,
                    description: `API in ${region}`,
                  },
                  { value: `${target}-web`, description: "Frontend worker" },
                ];
              },
            },
          },
          flags: {
            region: {
              type: String,
              short: "r",
              default: "us-east-1",
              description: "Target cloud region",
              complete: [
                { value: "us-east-1", description: "US East (N. Virginia)" },
                { value: "eu-west-1", description: "Europe (Ireland)" },
              ],
            },
          },
          run({ args, flags, log }) {
            log.step(
              `Deploying ${args.service ?? `${args.env}-api`}`,
              `env=${args.env}, region=${flags.region}`,
            );
            log.success(
              "Rollout complete (press Tab in input to test @clerc/plugin-completions)",
            );
          },
        }),
        completions(),
      ],
    }),
  presets: [
    { cmd: "deploy staging staging-api -r eu-west-1" },
    { cmd: "deploy prod prod-web" },
    { cmd: "help deploy" },
  ],
};

export const shellScripts: PlaygroundScenario = {
  createCli: () =>
    cli({
      name: "acme",
      version: "2.0.0",
      commands: [
        command("deploy <env>", {
          args: { env: Types.Enum("staging", "prod") },
          run() {},
        }),
        completions(),
      ],
    }),
  presets: [
    { cmd: "completions zsh" },
    { cmd: "completions bash" },
    { cmd: "completions fish" },
    { cmd: "completions powershell" },
  ],
};
