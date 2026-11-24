import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import { clerc } from "../.vitepress/components/playground-runtime.ts";

const scenario: PlaygroundScenario = {
  createCli: () =>
    clerc({
      name: "acme",
      version: "2.0.0",
      description: "Build and publish packages",
      examples: [["$ acme build src/index.ts -o dist", "Compile entry file"]],
      notes: ["Set NO_COLOR=1 to disable ANSI colors."],
    })
      .groups({
        commands: { core: "Core", db: "Database" },
        flags: { input: "Input Options" },
      })
      .command("build <entry>", {
        aliases: "b",
        group: "core",
        description: "Compile source files",
        args: { entry: { description: "Entry file path" } },
        flags: {
          output: { type: String, short: "o", description: "Output directory" },
          cache: {
            type: Boolean,
            default: true,
            group: "input",
            description: "Use build cache",
          },
        },
        run({ args, flags, log }) {
          log.success(`Compiled ${args.entry} -> ${flags.output ?? "dist"}`);
        },
      })
      .command("db", { group: "db", description: "Database utilities" })
      .command("db migrate", {
        group: "db",
        description: "Run pending migrations",
        run({ log }) {
          log.success("Database migrated");
        },
      }),
  source: `const cli = clerc({
  name: "acme",
  version: "2.0.0",
  description: "Build and publish packages",
  notes: ["Set NO_COLOR=1 to disable ANSI colors."],
})
  .groups({ commands: { core: "Core" }, flags: { input: "Input Options" } })
  .command("build <entry>", {
    aliases: "b",
    group: "core",
    flags: {
      output: { type: String, short: "o" },
      cache: { type: Boolean, default: true, group: "input" },
    },
    run({ args, log }) { log.success(args.entry); },
  });`,
  presets: [
    { cmd: "build --help" },
    { cmd: "--help" },
    { cmd: "db --help" },
    { cmd: "build src/index.ts -o dist" },
  ],
};

export default scenario;
