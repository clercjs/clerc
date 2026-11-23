import { createMemoryTerminal, createTestCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { Cli, Types } from "../src";

describe("built-in v2 editorial help", () => {
  it("renders single top hairline, eyebrow headings, and aligned sections", async () => {
    const terminal = createMemoryTerminal({ columns: 96 });

    const cli = Cli({
      scriptName: "acme",
      version: "2.0.0",
      description: "Build and deploy modern TypeScript apps",
      examples: [
        ["$ acme build src/index.ts -p 8080", "Build with custom port"],
      ],
      notes: ["Set NO_COLOR=1 to disable ANSI colors."],
    }).groups({
      commands: { core: "Core" },
      flags: { input: "Input Options" },
    });

    cli.command("build <entry>", {
      aliases: ["b"],
      group: "core",
      description: "Compile source files",
      args: {
        entry: { description: "Entry file path" },
      },
      flags: {
        output: { type: String, short: "o", description: "Output directory" },
        port: {
          type: Number,
          short: "p",
          default: 3000,
          env: "PORT",
          description: "Server port",
        },
        verbose: {
          type: Boolean,
          short: "v",
          description: "Enable verbose output",
        },
        format: {
          type: Types.Enum("json", "yaml"),
          default: "json",
          description: "Output format",
        },
        src: {
          type: String,
          group: "input",
          description: "Source directory",
        },
        cache: {
          type: Boolean,
          default: true,
          group: "input",
          description: "Use build cache",
        },
        secret: {
          type: String,
          hidden: true,
        },
      },
      run() {},
    });

    await cli.run(["build", "--help"], { terminal });

    expect(terminal.stdoutText()).toBe(
      [
        "acme build v2.0.0  alias: b",
        "Compile source files",
        "────────────────────────────────────────────────────────────────────────",
        "USAGE   acme build [options] <entry>",
        "",
        "ARGUMENTS",
        "  <entry>                     Entry file path",
        "",
        "OPTIONS",
        "  -o, --output <string>       Output directory",
        "  -p, --port <number>         Server port  [default: 3000] [env: PORT]",
        "  -v, --verbose               Enable verbose output",
        "      --format <json|yaml>    Output format  [default: json]",
        "",
        "INPUT OPTIONS",
        "      --src <string>          Source directory",
        "      --cache, --no-cache     Use build cache  [default: true]",
        "",
        "GLOBAL OPTIONS",
        "  -V, --version               Show version",
        "  -h, --help                  Show help",
      ].join("\n"),
    );

    terminal.clear();
    await cli.run(["--help"], { terminal });

    const rootOut = terminal.stdoutText();

    expect(rootOut).toContain(
      "acme v2.0.0\nBuild and deploy modern TypeScript apps",
    );
    expect(rootOut).toContain("\nCORE\n  build (b)");
    expect(rootOut).toContain("\nCOMMANDS\n");
    expect(rootOut.indexOf("\nCORE\n")).toBeLessThan(
      rootOut.indexOf("\nCOMMANDS\n"),
    );

    // Commands and Options snap to the same column when within threshold
    const buildDescCol = rootOut
      .split("\n")
      .find((l) => l.includes("build (b)"))!
      .indexOf("Compile source files");
    const helpFlagDescCol = rootOut
      .split("\n")
      .find((l) => l.includes("-h, --help"))!
      .indexOf("Show help");

    expect(buildDescCol).toBe(helpFlagDescCol);
    expect(rootOut).toContain("\nEXAMPLES\n");
    expect(rootOut).toContain(
      "  # Build with custom port\n  $ acme build src/index.ts -p 8080",
    );
    expect(rootOut).toContain(
      "\nNOTES\n  Set NO_COLOR=1 to disable ANSI colors.",
    );
  });

  it("decouples command and option columns when an option is very wide", async () => {
    const terminal = createMemoryTerminal({ columns: 100 });
    const cli = Cli({ scriptName: "acme", version: "1.0.0" }).flags({
      experimentalModuleResolution: {
        type: String,
        description: "Resolution strategy",
      },
    });
    cli.command("db", { description: "Database tools", run() {} });

    await cli.run(["--help"], { terminal });

    const lines = terminal.stdoutText().split("\n");
    const dbLine = lines.find((l) => l.startsWith("  db "))!;

    expect(dbLine.indexOf("Database tools")).toBeLessThan(20);
    expect(terminal.stdoutText()).toContain("Resolution strategy");
  });

  it("falls back to ASCII top rule and stacked examples on narrow terminals", async () => {
    const terminal = createMemoryTerminal({ columns: 68, unicode: false });
    const cli = Cli({
      scriptName: "acme",
      version: "2.0.0",
      examples: [
        ["$ acme deploy prod --port 8080 -n", "Preview a production deploy"],
      ],
      notes: ["Keep it tidy."],
    });
    cli.command("deploy", { description: "Deploy app", run() {} });

    await cli.run(["--help"], { terminal });

    const out = terminal.stdoutText();

    expect(out).toContain(
      "--------------------------------------------------------------------",
    );
    expect(out).not.toContain("─");
    expect(out).toContain(
      "  # Preview a production deploy\n  $ acme deploy prod --port 8080 -n",
    );
    expect(out).toContain("  Keep it tidy.");
  });

  it("shows subcommands when a namespace-only parent command is invoked", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli();
    cli.command("db migrate", { description: "Run migrations", run() {} });
    cli.command("db seed", { description: "Seed data", run() {} });

    await cli.run(["db"], { terminal });

    expect(terminal.stdoutText()).toContain("test db v1.0.0");
    expect(terminal.stdoutText()).toContain("\nSUBCOMMANDS\n");
    expect(terminal.stdoutText()).toContain("migrate");
    expect(terminal.stdoutText()).toContain("seed");
  });

  it("does not render blank Arguments section when only -- parameter is defined", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli();
    cli.command("exec --", { run() {} });

    await cli.run(["exec", "--help"], { terminal });

    expect(terminal.stdoutText()).not.toContain("\nARGUMENTS\n");
    expect(terminal.stdoutText()).toContain("USAGE   test exec [options] [--]");
  });

  it("renders dynamic scriptName in help command examples", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli();

    await cli.run(["help", "help"], { terminal });

    expect(terminal.stdoutText()).toContain("$ test help");
  });
});
