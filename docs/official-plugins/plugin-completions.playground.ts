import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import { Types, clerc } from "../.vitepress/components/playground-runtime.ts";

const scenario: PlaygroundScenario = {
  createCli: () =>
    clerc({ name: "acme", version: "2.0.0" })
      .command("deploy <env> [service]", {
        aliases: ["d"],
        description: "Deploy application with context-aware completions",
        args: {
          env: {
            type: Types.Enum("staging", "prod"),
            description: "Target environment",
          },
          service: {
            description: "Service worker name",
            complete({ args }) {
              const target = (args.env as string | undefined) ?? "staging";

              return [
                { value: `${target}-api`, description: "REST and GraphQL API" },
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
            complete: () => [
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
            "Rollout complete (press Tab while typing to test completions)",
          );
        },
      })
      .command("completions <shell>", {
        description: "Print shell completion setup script",
        args: { shell: Types.Enum("zsh", "bash", "fish", "powershell") },
        run({ args, terminal }) {
          terminal.stdout(`#compdef acme (${args.shell})`);
          terminal.stdout(
            "_acme() { _describe 'acme' \"$(acme __complete -- zsh $words)\" }",
          );
          terminal.stdout("compdef _acme acme");
        },
      }),
  source: `cli.command("deploy <env> [service]", {
  args: {
    env: Types.Enum("staging", "prod"), // auto-completed
    service: {
      complete: ({ args }) => [
        { value: \`\${args.env ?? "staging"}-api\`, description: "API worker" },
        { value: \`\${args.env ?? "staging"}-web\`, description: "Frontend" },
      ],
    },
  },
  flags: {
    region: {
      type: String,
      short: "r",
      complete: () => ["us-east-1", "eu-west-1"],
    },
  },
  run({ args, flags, log }) { log.success(args.service, flags); },
});`,
  presets: [
    { cmd: "deploy staging staging-api -r eu-west-1" },
    { cmd: "deploy prod prod-web" },
    { cmd: "completions zsh" },
    { cmd: "help deploy" },
  ],
};

export default scenario;
