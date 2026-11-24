import type { PlaygroundScenario } from "../.vitepress/components/playground-runtime.ts";
import {
  clerc,
  defaultHelpSections,
} from "../.vitepress/components/playground-runtime.ts";

export const groupedHelp: PlaygroundScenario = {
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
  presets: [{ cmd: "build --help" }, { cmd: "--help" }, { cmd: "db --help" }],
};

export const customHelp: PlaygroundScenario = {
  createCli: () =>
    clerc({
      name: "acme",
      version: "2.0.0",
      description: "Build and publish packages",
      notes: ["This note is hidden by sections.notes."],
      help: {
        footer: (meta) => `Docs: https://example.com/${meta.name}`,
        sections: {
          header: (doc, ctx) => defaultHelpSections.header(doc, ctx),
          notes: () => undefined,
        },
      },
    }).command("build <entry>", {
      description: "Compile source files",
      run() {},
    }),
  presets: [{ cmd: "--help" }, { cmd: "build --help" }],
};
