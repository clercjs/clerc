import { createMemoryTerminal, createTestCli } from "@clerc/test-utils";
import { Types } from "clerc";
import { describe, expect, expectTypeOf, it } from "vitest";

import { ShellCompDirective, completionsPlugin } from "../src";

describe("plugin-completions v2", () => {
  it("generates zsh, bash, fish, and powershell scripts via ctx.terminal and completes enums & flags", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli({ defaultCommand: "build" })
      .flags({
        token: {
          type: String,
          required: true,
          description: "Global auth token",
        },
      })
      .use(completionsPlugin());

    cli.command("build [env]", {
      aliases: ["b"],
      description: "Build project",
      args: {
        env: {
          description: "Target env",
          type: Types.Enum("dev", "prod"),
        },
      },
      flags: {
        dryRun: { type: Boolean, short: "n", description: "Dry run" },
        cache: { type: Boolean, default: true, description: "Use cache" },
      },
      run() {},
    });
    cli.command("internal", { hidden: true, run() {} });

    for (const shell of ["zsh", "bash", "fish", "powershell"] as const) {
      terminal.clear();
      const res = await cli.run(["completions", shell], { terminal });

      expect(res.ok).toBeTruthy();
      expect(terminal.stdoutText()).toMatch(/complete (?:'--'|--)/);
    }

    terminal.clear();
    await cli.run(["completions", "fish"], { terminal });

    expect(terminal.stdoutText()).toContain(
      "function __test_perform_completion",
    );
    expect(terminal.stdoutText()).toContain("set -l shellCompDirectiveError");

    // Works even when global required flags (--token) are not set!
    terminal.clear();
    await cli.run(["complete", "--", "--dry"], { terminal });

    expect(terminal.stdoutText()).toBe("--dry-run\tDry run\n:4");

    // Negatable boolean flag with default: true suggests --no-cache
    terminal.clear();
    await cli.run(["complete", "--", "build", "--no-"], { terminal });

    expect(terminal.stdoutText()).toContain("--no-cache\tUse cache");
    expect(terminal.stdoutText()).toContain("--no-dry-run\tDry run");

    // Alias resolution + automatic enum values
    terminal.clear();
    await cli.run(["complete", "--", "b", ""], { terminal });

    expect(terminal.stdoutText()).toBe("dev\nprod\n:4");
  });

  it("completes multi-level subcommand paths for built-in help [command...]", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli()
      .flags({ server: { type: String, required: true } })
      .use(completionsPlugin());

    cli.command("deploy", {
      description: "Deploy application",
      run() {},
    });
    cli.command("db", {
      description: "Database management",
    });
    cli.command("db migrate", {
      description: "Run pending migrations",
      run() {},
    });
    cli.command("db seed", {
      description: "Seed development data",
      run() {},
    });
    cli.command("secret", {
      hidden: true,
      run() {},
    });
    cli.command("unlisted", {
      complete: false,
      run() {},
    });

    // Top-level: acme help <TAB>
    await cli.run(["complete", "--", "help", ""], { terminal });
    const topOut = terminal.stdoutText();

    expect(topOut).toContain("deploy\tDeploy application");
    expect(topOut).toContain("db\tDatabase management");
    expect(topOut).toContain("completions\tGenerate shell completion scripts");
    expect(topOut).not.toContain("secret");
    expect(topOut).not.toContain("unlisted");
    expect(topOut).not.toContain("complete\t");

    // Prefix filter: acme help d<TAB>
    terminal.clear();
    await cli.run(["complete", "--", "help", "d"], { terminal });

    expect(terminal.stdoutText()).toBe(
      ["deploy\tDeploy application", "db\tDatabase management", ":4"].join(
        "\n",
      ),
    );

    // Nested level: acme help db <TAB>
    terminal.clear();
    await cli.run(["complete", "--", "help", "db", ""], { terminal });

    expect(terminal.stdoutText()).toBe(
      [
        "migrate\tRun pending migrations",
        "seed\tSeed development data",
        ":4",
      ].join("\n"),
    );

    // Nested prefix: acme help db m<TAB>
    terminal.clear();
    await cli.run(["complete", "--", "help", "db", "m"], { terminal });

    expect(terminal.stdoutText()).toBe("migrate\tRun pending migrations\n:4");
  });

  it("supports async custom complete() on commands, args, and flags with typed context and file directives", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli()
      .flags({
        profile: { type: String, default: "default" },
      })
      .use(completionsPlugin());

    cli.command("deploy <env> <service>", {
      flags: {
        region: {
          type: String,
          short: "r",
          async complete({ current }) {
            await Promise.resolve();

            return [
              { value: "us-east-1", description: "US East" },
              { value: "eu-west-1", description: "Europe" },
            ].filter((item) => item.value.startsWith(current));
          },
        },
        config: {
          type: String,
          complete: () => ({ files: ["ts", "json"] }),
        },
        tags: {
          type: Types.Enum("v1", "v2", "latest"),
          multiple: true,
          delimiter: ",",
        },
      },
      args: {
        env: Types.Enum("staging", "prod"),
        service: {
          async complete({ args, flags }) {
            await Promise.resolve();

            return [`${args.env ?? "dev"}-${flags.region ?? "global"}-api`];
          },
        },
      },
      complete(ctx) {
        expectTypeOf(ctx.args).toEqualTypeOf<
          Partial<{ env: "staging" | "prod"; service: string }>
        >();
        expectTypeOf(ctx.flags).toEqualTypeOf<
          Partial<{
            region: string | undefined;
            config: string | undefined;
            tags: ("v1" | "v2" | "latest")[];
            profile: string;
          }>
        >();

        return undefined;
      },
      run(ctx) {
        expectTypeOf(ctx.flags.region).toEqualTypeOf<string | undefined>();
      },
    });

    cli.command("checkout <branch>", {
      async complete() {
        await Promise.resolve();

        return {
          items: [
            { value: "main", description: "Default branch" },
            { value: "release/v2", description: "Release branch" },
          ],
          keepOrder: true,
        };
      },
      run() {},
    });

    // 1. Async flag completion (--region <TAB> and --region=eu<TAB>)
    await cli.run(["complete", "--", "deploy", "--region", ""], { terminal });

    expect(terminal.stdoutText()).toBe(
      ["us-east-1\tUS East", "eu-west-1\tEurope", ":4"].join("\n"),
    );

    terminal.clear();
    await cli.run(["complete", "--", "deploy", "--region=eu"], { terminal });

    expect(terminal.stdoutText()).toBe("eu-west-1\tEurope\n:4");

    // 2. File extension directive (--config <TAB>)
    terminal.clear();
    await cli.run(["complete", "--", "deploy", "--config", ""], { terminal });

    expect(terminal.stdoutText()).toBe(
      `ts\njson\n:${ShellCompDirective.FilterFileExt}`,
    );

    // 3. Delimited array flag (--tags=v1,l<TAB>)
    terminal.clear();
    await cli.run(["complete", "--", "deploy", "--tags=v1,l"], { terminal });

    expect(terminal.stdoutText()).toBe("v1,latest\n:4");

    // 4. Context-aware async arg completion reading preceding args.env & flags.region
    terminal.clear();
    await cli.run(["complete", "--", "deploy", "prod", "-r", "eu-west-1", ""], {
      terminal,
    });

    expect(terminal.stdoutText()).toBe("prod-eu-west-1-api\n:4");

    // 5. Command-level async complete() + keepOrder directive
    terminal.clear();
    await cli.run(["complete", "--", "checkout", ""], { terminal });

    expect(terminal.stdoutText()).toBe(
      [
        "main\tDefault branch",
        "release/v2\tRelease branch",
        `:${ShellCompDirective.NoFileComp | ShellCompDirective.KeepOrder}`,
      ].join("\n"),
    );
  });

  it("reports structured error when shell type is missing", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli().use(completionsPlugin());

    const res = await cli.run(["completions"], { terminal });

    expect(res.ok).toBeFalsy();
    expect(res.exitCode).toBe(2);
    expect(terminal.stderrText()).toContain(
      "missing required argument '<shell>'",
    );
  });

  it("omits already-used non-repeatable flags and rule conflicts (flag + arg), keeps counters/arrays, and parses defaultCommand flags", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli({ defaultCommand: "deploy" })
      .use(completionsPlugin())
      .command("deploy [env]", {
        args: { env: Types.Enum("staging", "prod") },
        flags: {
          port: { type: Number, short: "p", description: "Server port" },
          all: { type: Boolean, description: "Deploy all environments" },
          json: { type: Boolean, description: "JSON" },
          yaml: { type: Boolean, description: "YAML" },
          tags: {
            type: String,
            multiple: true,
            short: "t",
            description: "Tags",
          },
          verbose: { type: Types.Counter, short: "v", description: "Verbose" },
        },
        rules: ({ exclusive, oneOf, flag, arg }) => [
          exclusive(flag("json"), flag("yaml")),
          oneOf(arg("env"), flag("all")),
        ],
        run() {},
      });

    // Already-used single/boolean flags and their exclusive partners are omitted
    await cli.run(["complete", "--", "deploy", "--json", "--quiet", "--"], {
      terminal,
    });
    const out = terminal.stdoutText();

    expect(out).not.toContain("--json");
    expect(out).not.toContain("--yaml");
    expect(out).not.toContain("--quiet");
    expect(out).toContain("--tags");
    expect(out).toContain("--verbose");
    expect(out).toContain("--port");

    // Positional arg provided -> conflicting --all flag is hidden
    terminal.clear();
    await cli.run(["complete", "--", "deploy", "prod", "--"], { terminal });

    expect(terminal.stdoutText()).not.toContain("--all");

    // --all flag provided -> conflicting [env] positional completions are skipped
    terminal.clear();
    await cli.run(["complete", "--", "deploy", "--all", ""], { terminal });

    expect(terminal.stdoutText()).toBe(":4");

    // Local flag before positional on defaultCommand is consumed instead of treated as positional <env>
    terminal.clear();
    await cli.run(["complete", "--", "-p", "8080", ""], { terminal });

    expect(terminal.stdoutText()).toContain("staging");
    expect(terminal.stdoutText()).toContain("prod");

    // Trailing missing-value flag after an earlier flag triggers value completion cleanly
    terminal.clear();
    await cli.run(["complete", "--", "deploy", "--json", "-p", ""], {
      terminal,
    });

    expect(terminal.stdoutText()).toBe(":4");
  });
});
