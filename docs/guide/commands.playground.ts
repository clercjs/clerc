import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import { clerc } from "../.vitepress/components/playground-runtime.ts";

const scenario: PlaygroundScenario = {
  createCli: () =>
    clerc({
      name: "vite",
      version: "2.0.0",
      description: "Frontend build tool",
      defaultCommand: "dev",
    })
      .command("dev [root]", {
        description: "Start dev server",
        flags: { port: { type: Number, short: "p", default: 5173 } },
        run({ args, flags, log }) {
          log.step(
            `Dev server running for '${args.root ?? "."}'`,
            `http://localhost:${flags.port}`,
          );
        },
      })
      .command("build [root]", {
        aliases: "b",
        description: "Build for production",
        run({ args, log }) {
          log.success(`Built '${args.root ?? "."}' into dist/`);
        },
      })
      .command("db", { description: "Database utilities" })
      .command("db migrate", {
        aliases: "m",
        description: "Apply pending migrations",
        run({ log }) {
          log.success("Applied 3 migrations");
        },
      })
      .command("exec <cmd> [args...]", {
        description: "Run tool forwarding child flags",
        stopAtFirstPositional: true,
        flags: { quiet: { type: Boolean, short: "q" } },
        run({ args, flags, log }) {
          log.info(`cmd=${args.cmd}, quiet=${String(flags.quiet)}`, {
            forwardedArgs: args.args,
          });
        },
      })
      .command("init-legacy", {
        description: "Scaffold legacy template",
        deprecated: "use 'vite create' instead",
        run({ log }) {
          log.info("Initialized template");
        },
      }),
  source: `const cli = clerc({
  name: "vite",
  version: "2.0.0",
  defaultCommand: "dev",
})
  .command("dev [root]", {
    flags: { port: { type: Number, short: "p", default: 5173 } },
    run: ({ args, flags, log }) =>
      log.step(\`Dev server for '\${args.root ?? "."}'\`, \`port=\${flags.port}\`),
  })
  .command("db", { description: "Database utilities" })
  .command("db migrate", { aliases: "m", run({ log }) { log.success("Migrated"); } })
  .command("exec <cmd> [args...]", {
    stopAtFirstPositional: true,
    flags: { quiet: { type: Boolean, short: "q" } },
    run: ({ args, flags, log }) => log.info(\`cmd=\${args.cmd}\`, args.args),
  })
  .command("init-legacy", {
    deprecated: "use 'vite create' instead",
    run({ log }) { log.info("Initialized"); },
  });`,
  presets: [
    { cmd: "./app -p 4000" },
    { cmd: "--help" },
    { cmd: "db" },
    { cmd: "exec -q git --status -s" },
    { cmd: "init-legacy" },
  ],
};

export default scenario;
