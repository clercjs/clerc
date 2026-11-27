import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import { cli, command } from "../.vitepress/components/playground-runtime.ts";

export const subcommands: PlaygroundScenario = {
  createCli: () =>
    cli({
      name: "acme",
      version: "2.0.0",
      commands: [
        command("db", {
          description: "Database utilities",
          commands: [
            command("migrate", {
              aliases: "m",
              description: "Apply pending migrations",
              run({ calledAs, commandPath, log }) {
                log.success("Applied 3 migrations", {
                  calledAs,
                  commandPath,
                });
              },
            }),
            command("seed", {
              description: "Seed sample data",
              run({ log }) {
                log.success("Seeded 42 records");
              },
            }),
          ],
        }),
      ],
    }),
  presets: [
    { cmd: "db" },
    { cmd: "db migrate" },
    { cmd: "db m" },
    { cmd: "db migrat" },
  ],
};

export const defaultCommand: PlaygroundScenario = {
  createCli: () => {
    const dev = command("dev [root]", {
      description: "Start dev server",
      flags: { port: { type: Number, short: "p", default: 5173 } },
      run({ args, flags, log }) {
        log.step(
          `Dev server running for '${args.root ?? "."}'`,
          `http://localhost:${flags.port}`,
        );
      },
    });

    const build = command("build [root]", {
      aliases: "b",
      description: "Build for production",
      run({ args, log }) {
        log.success(`Built '${args.root ?? "."}' into dist/`);
      },
    });

    return cli({
      name: "vite",
      version: "2.0.0",
      description: "Frontend build tool",
      commands: [dev, build],
      default: dev,
    });
  },
  presets: [
    { cmd: "./app -p 4000" },
    { cmd: "" },
    { cmd: "build ./app" },
    { cmd: "--help" },
  ],
};

export const stopParsing: PlaygroundScenario = {
  createCli: () =>
    cli({
      name: "vite",
      version: "2.0.0",
      commands: [
        command("exec <cmd> [args...]", {
          description: "Run tool forwarding child flags",
          stopParsing: "first-positional",
          flags: {
            quiet: {
              type: Boolean,
              short: "q",
              description: "Suppress wrapper output",
            },
          },
          run({ args, flags, log }) {
            log.info(`cmd=${args.cmd}, quiet=${String(flags.quiet)}`, {
              forwardedArgs: args.args,
            });
          },
        }),
        command("dev [args...]", {
          description: "Forward unknown flags to the underlying dev server",
          stopParsing: "unknown-flag",
          flags: {
            config: {
              type: String,
              short: "c",
              description: "Config file path",
            },
          },
          run({ args, flags, log }) {
            log.info(`config=${flags.config ?? "default"}`, {
              forwardedArgs: args.args,
            });
          },
        }),
      ],
    }),
  presets: [
    { cmd: "exec -q git --status -s" },
    { cmd: "exec node -e 'console.log(1)'" },
    { cmd: "dev -c vite.config.ts --port 3000 --open" },
  ],
};

export const deprecated: PlaygroundScenario = {
  createCli: () =>
    cli({
      name: "vite",
      version: "2.0.0",
      commands: [
        command("init-legacy", {
          description: "Scaffold legacy template",
          deprecated: "use 'vite create' instead",
          run({ log }) {
            log.info("Initialized legacy template");
          },
        }),
        command("create [dir]", {
          description: "Scaffold a new project",
          run({ args, log }) {
            log.success(`Created project in '${args.dir ?? "."}'`);
          },
        }),
      ],
    }),
  presets: [{ cmd: "init-legacy" }, { cmd: "create my-app" }],
};
