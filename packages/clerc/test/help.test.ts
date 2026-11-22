import { createMemoryTerminal, createTestCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { Clerc, Types, helpPlugin } from "../src";

describe("helpPlugin v2 Modern Precision layout", () => {
  it("renders crisp aligned help without Boolean or default:false noise", async () => {
    const terminal = createMemoryTerminal({ columns: 90 });

    const cli = Clerc.create({
      scriptName: "acme",
      version: "2.0.0",
      description: "Build and deploy modern TypeScript apps",
    })
      .use(
        helpPlugin({
          examples: [
            ["$ acme build src/index.ts -p 8080", "Build with custom port"],
          ],
          notes: ["Set NO_COLOR=1 to disable ANSI colors."],
        }),
      )
      .group("flags", "input", "Input Options")
      .command("build", {
        aliases: ["b"],
        description: "Compile source files",
        parameters: [
          { key: "<entry>", description: "Entry file path" },
        ] as const,
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
        run: () => {},
      });

    await cli.run(["build", "--help"], { terminal });

    expect(terminal.stdoutText()).toBe(
      [
        "acme build v2.0.0 — Compile source files",
        "Alias: b",
        "",
        "Usage:",
        "  acme build [options] <entry>",
        "",
        "Arguments:",
        "  <entry>  Entry file path",
        "",
        "Options:",
        "  -o, --output <string>     Output directory",
        "  -p, --port <number>       Server port  (default: 3000, env: PORT)",
        "  -v, --verbose             Enable verbose output",
        '      --format <json|yaml>  Output format  (default: "json")',
        "",
        "  Input Options:",
        "    --src <string>       Source directory",
        "    --cache, --no-cache  Use build cache  (default: true)",
        "",
        "Global Options:",
        "  -h, --help  Show help",
      ].join("\n"),
    );

    // Re-running root --help must NOT leak the previous "build" command (v1 bug fixed!)
    terminal.clear();
    await cli.run(["--help"], { terminal });

    expect(terminal.stdoutText()).toContain(
      "acme v2.0.0 — Build and deploy modern TypeScript apps",
    );
    expect(terminal.stdoutText()).toContain("Commands:");
    expect(terminal.stdoutText()).toContain("build (b)");
    expect(terminal.stdoutText()).toContain("Examples:");
    expect(terminal.stdoutText()).toContain("Notes:");
  });

  it("shows subcommands when a namespace-only parent command is invoked", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli()
      .command("db migrate", { description: "Run migrations", run: () => {} })
      .command("db seed", { description: "Seed data", run: () => {} });

    await cli.run(["db"], { terminal });

    expect(terminal.stdoutText()).toContain("test db v1.0.0");
    expect(terminal.stdoutText()).toContain("Subcommands:");
    expect(terminal.stdoutText()).toContain("migrate");
    expect(terminal.stdoutText()).toContain("seed");
  });

  it("does not render blank Arguments section when only -- parameter is defined", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli().command("exec", {
      parameters: ["--"] as const,
      run: () => {},
    });

    await cli.run(["exec", "--help"], { terminal });

    expect(terminal.stdoutText()).not.toContain("Arguments:");
    expect(terminal.stdoutText()).toContain("test exec [options] [--]");
  });

  it("populates real scriptName in help command examples even when scriptName is set after Cli()", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli().scriptName("renamed-cli");

    await cli.run(["help", "help"], { terminal });

    expect(terminal.stdoutText()).toContain("$ renamed-cli help");
  });
});
