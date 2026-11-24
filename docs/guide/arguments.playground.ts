import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import { clerc } from "../.vitepress/components/playground-runtime.ts";

const scenario: PlaygroundScenario = {
  createCli: () =>
    clerc({ name: "acme", version: "2.0.0" })
      .command("copy <source-path> [dest-path] [extra-files...]", {
        description: "Copy files into destination",
        args: {
          sourcePath: { description: "Source file" },
          destPath: { default: "./dist", description: "Destination dir" },
          extraFiles: { description: "Additional files" },
        },
        run({ args, log }) {
          log.info("Resolved ctx.args", args);
        },
      })
      .command("deploy <token> [region]", {
        description: "Deploy using token arg or DEPLOY_TOKEN",
        args: {
          token: { env: "DEPLOY_TOKEN", description: "API token" },
          region: { default: "us-east-1", description: "Target region" },
        },
        run({ args, log }) {
          log.success(`Authenticated (${args.region})`);
        },
      })
      .command("run <script> -- [pass-through...]", {
        description: "Run package script with passthrough args",
        run({ args, log }) {
          log.step(`Running script '${args.script}'`, {
            passThrough: args.passThrough,
          });
        },
      }),
  source: `cli
  .command("copy <source-path> [dest-path] [extra-files...]", {
    args: { destPath: { default: "./dist" } },
    run({ args, log }) { log.info("Resolved ctx.args", args); },
  })
  .command("deploy <token> [region]", {
    args: {
      token: { env: "DEPLOY_TOKEN" },
      region: { default: "us-east-1" },
    },
    run: ({ args, log }) => log.success(\`Authenticated (\${args.region})\`),
  })
  .command("run <script> -- [pass-through...]", {
    run: ({ args, log }) =>
      log.step(\`Running '\${args.script}'\`, { passThrough: args.passThrough }),
  });`,
  presets: [
    { cmd: "copy src/index.ts out a.ts b.ts" },
    { cmd: "deploy" },
    { cmd: "run test -- --watch --bail" },
    { cmd: "copy --help" },
  ],
};

export default scenario;
