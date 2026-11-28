import { cli, command, defaultHelpSections, group } from "clerc";

import type { PlaygroundScenario } from "../.vitepress/playground/runtime.ts";

export const groupedHelp: PlaygroundScenario = {
  createCli: () => {
    const build = command("build <entry>", {
      aliases: "b",
      description: "Compile source files",
      args: { entry: { description: "Entry file path" } },
      flags: [
        {
          output: { type: String, short: "o", description: "Output directory" },
        },
        group("Input Options", {
          cache: {
            type: Boolean,
            default: true,
            description: "Use build cache",
          },
        }),
      ],
      run({ args, flags, log }) {
        log.success(`Compiled ${args.entry} -> ${flags.output ?? "dist"}`);
      },
    });

    const db = command("db", {
      description: "Database utilities",
      commands: [
        command("migrate", {
          description: "Run pending migrations",
          run({ log }) {
            log.success("Database migrated");
          },
        }),
      ],
    });

    return cli({
      name: "acme",
      version: "2.0.0",
      description: "Build and publish packages",
      examples: [["$ acme build src/index.ts -o dist", "Compile entry file"]],
      notes: ["Set NO_COLOR=1 to disable ANSI colors."],
      commands: [group("Core", [build]), group("Database", [db])],
    });
  },
  presets: [{ cmd: "build --help" }, { cmd: "--help" }, { cmd: "db --help" }],
};

export const customHelp: PlaygroundScenario = {
  createCli: () =>
    cli({
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
      commands: [
        command("build <entry>", {
          description: "Compile source files",
          run() {},
        }),
      ],
    }),
  presets: [{ cmd: "--help" }, { cmd: "build --help" }],
};
