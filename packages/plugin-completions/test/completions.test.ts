import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createMemoryTerminal, createTestCli } from "@clerc/test-utils";
import { Complete, Types } from "clerc";
import { describe, expect, expectTypeOf, it } from "vitest";

import { ShellCompDirective, completionsPlugin } from "../src";

const hasShell = (shell: string): boolean =>
  spawnSync(shell, ["--version"], { stdio: "ignore" }).status === 0;

describe("plugin-completions v2", () => {
  it("generates pure-static zsh, bash, fish, and powershell scripts when no dynamic handlers exist", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli()
      .flags({
        token: {
          type: String,
          required: true,
          description: "Global auth token",
        },
      })
      .use(completionsPlugin());

    cli.command("build [env]", {
      default: true,
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
      const script = terminal.stdoutText();

      expect(res.ok).toBeTruthy();
      // Static-only CLI must not emit any dynamic binary fallback
      expect(script).not.toMatch(/\bcomplete (?:'--'|-- )/);
      expect(script).toContain("build");
      expect(script).toContain("--dry-run");
      expect(script).toContain("--no-cache");
      expect(script).toContain("dev");
      expect(script).toContain("prod");
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

  it("supports static declarative complete values on flags, args, and commands without dynamic fallback", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli()
      .use(completionsPlugin())
      .command("deploy [region]", {
        args: {
          region: {
            complete: [
              { value: "us-east-1", description: "US East" },
              { value: "eu-west-1", description: "Europe" },
            ],
          },
        },
        flags: {
          config: {
            type: String,
            complete: Complete.file("ts", "json"),
          },
          outDir: {
            type: String,
            complete: Complete.dir(),
          },
          anyFile: {
            type: String,
            complete: Complete.file(),
          },
          hidden: {
            type: String,
            complete: Complete.none,
          },
        },
        run() {},
      })
      .command("open [target]", {
        complete: Complete.list(["alpha", "beta"], {
          keepOrder: true,
          noSpace: true,
        }),
        run() {},
      });

    await cli.run(["complete", "--", "deploy", "eu"], { terminal });

    expect(terminal.stdoutText()).toBe("eu-west-1\tEurope\n:4");

    terminal.clear();
    await cli.run(["complete", "--", "deploy", "--config", ""], { terminal });

    expect(terminal.stdoutText()).toBe(
      `ts\njson\n:${ShellCompDirective.FilterFileExt}`,
    );

    terminal.clear();
    await cli.run(["complete", "--", "deploy", "--out-dir", ""], { terminal });

    expect(terminal.stdoutText()).toBe(`:${ShellCompDirective.FilterDirs}`);

    terminal.clear();
    await cli.run(["complete", "--", "open", ""], { terminal });

    expect(terminal.stdoutText()).toBe(
      `alpha\nbeta\n:${ShellCompDirective.NoFileComp | ShellCompDirective.KeepOrder | ShellCompDirective.NoSpace}`,
    );

    // Every shell script compiles these statically without emitting dynamic fallback
    for (const shell of ["zsh", "bash", "fish", "powershell"] as const) {
      terminal.clear();
      await cli.run(["completions", shell], { terminal });
      const script = terminal.stdoutText();

      expect(script).not.toMatch(/\bcomplete (?:'--'|-- )/);
      expect(script).toContain("us-east-1");
      expect(script).toContain("eu-west-1");
      expect(script).toContain("alpha");
    }
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
          complete: () => Complete.file("ts", "json"),
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

        return Complete.list(
          [
            { value: "main", description: "Default branch" },
            { value: "release/v2", description: "Release branch" },
          ],
          { keepOrder: true },
        );
      },
      run() {},
    });

    // Hybrid CLI emits dynamic fallback in all 4 shells alongside static tables
    for (const shell of ["zsh", "bash", "fish", "powershell"] as const) {
      terminal.clear();
      const res = await cli.run(["completions", shell], { terminal });

      expect(res.ok).toBeTruthy();
      expect(terminal.stdoutText()).toMatch(/\bcomplete (?:'--'|-- )/);
    }

    // 1. Async flag completion (--region <TAB> and --region=eu<TAB>)
    terminal.clear();
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

  it("omits already-used non-repeatable flags and rule conflicts (flag + arg), keeps counters/arrays, and parses default command flags", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli()
      .use(completionsPlugin())
      .command("deploy [env]", {
        default: true,
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

  it("stops flag completion once stopParsing triggers for presets and predicates", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli()
      .use(completionsPlugin())
      .command("exec <cmd> [args...]", {
        stopParsing: "first-positional",
        flags: { quiet: { type: Boolean, short: "q", description: "Quiet" } },
        run() {},
      })
      .command("dev [args...]", {
        stopParsing: "unknown-flag",
        flags: { config: { type: String, description: "Config file" } },
        run() {},
      })
      .command("run <env> <script> [args...]", {
        stopParsing: (token) =>
          token.kind === "positional" && token.positionalCount === 1,
        flags: { verbose: { type: Boolean, description: "Verbose" } },
        run() {},
      });

    // first-positional: still completes flags before first positional, stops after
    await cli.run(["complete", "--", "exec", "--"], { terminal });

    expect(terminal.stdoutText()).toContain("--quiet");

    terminal.clear();
    await cli.run(["complete", "--", "exec", "git", "--"], { terminal });

    expect(terminal.stdoutText()).toBe(":4");

    // unknown-flag: still completes flags before unknown flag, stops after
    terminal.clear();
    await cli.run(["complete", "--", "dev", "--"], { terminal });

    expect(terminal.stdoutText()).toContain("--config");

    terminal.clear();
    await cli.run(["complete", "--", "dev", "--watch", "--"], { terminal });

    expect(terminal.stdoutText()).toBe(":4");

    // custom predicate: allows flags after 1st positional, stops after 2nd
    terminal.clear();
    await cli.run(["complete", "--", "run", "prod", "--"], { terminal });

    expect(terminal.stdoutText()).toContain("--verbose");

    terminal.clear();
    await cli.run(["complete", "--", "run", "prod", "app.ts", "--"], {
      terminal,
    });

    expect(terminal.stdoutText()).toBe(":4");
  });

  it("completes scoped flags and subcommands when scoped flags precede subcommand names", async () => {
    const terminal = createMemoryTerminal();
    const cli = createTestCli().use(completionsPlugin());

    const pr = cli
      .subcommand("pr", { description: "Manage pull requests" })
      .flags({
        repo: {
          type: String,
          short: "R",
          description: "Target repository",
        },
      });
    pr.command("ls", { default: true, description: "List PRs", run() {} });
    pr.command("merge <id>", { description: "Merge PR", run() {} });

    await cli.run(["complete", "--", "pr", "--repo", "org/app", ""], {
      terminal,
    });
    const out = terminal.stdoutText();

    expect(out).toContain("ls\tList PRs");
    expect(out).toContain("merge\tMerge PR");
  });

  it.skipIf(!hasShell("fish"))(
    "executes hybrid Fish completions with 0 binary invocations on static slots and 1 on dynamic slots",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "clerc-fish-comp-"));
      try {
        const logFile = join(dir, "calls.log");
        const stubBin = join(dir, "stub.sh");
        writeFileSync(
          stubBin,
          `#!/usr/bin/env bash\necho "$*" >> ${JSON.stringify(logFile)}\nprintf "dyn-item\\tDynamic item\\n:4\\n"\n`,
          "utf8",
        );
        chmodSync(stubBin, 0o755);

        const cli = createTestCli({ name: "mycli", version: "1.0.0" })
          .use(completionsPlugin({ executable: stubBin }))
          .command("deploy [env] [service]", {
            aliases: ["d"],
            description: "Deploy app",
            args: {
              env: Types.Enum("staging", "prod"),
              service: {
                complete: () => ["api-svc"],
              },
            },
            flags: {
              all: { type: Boolean, description: "Deploy all" },
              json: { type: Boolean, description: "JSON" },
              yaml: { type: Boolean, description: "YAML" },
              cache: { type: Boolean, default: true, description: "Use cache" },
              tags: {
                type: Types.Enum("v1", "v2", "latest"),
                multiple: true,
                delimiter: ",",
                description: "Tags",
              },
              config: {
                type: String,
                complete: Complete.file("ts", "json"),
              },
              outDir: {
                type: String,
                complete: Complete.dir(),
              },
              region: {
                type: String,
                short: "r",
                complete: () => ["us-east-1"],
              },
            },
            rules: ({ exclusive, oneOf, flag, arg }) => [
              exclusive(flag("json"), flag("yaml")),
              oneOf(arg("env"), flag("all")),
            ],
            run() {},
          })
          .command("exec <cmd> [args...]", {
            stopParsing: "first-positional",
            flags: { quiet: Boolean },
            run() {},
          })
          .command("run <env> [args...]", {
            stopParsing: (token) => token.kind === "positional",
            flags: { verbose: Boolean },
            run() {},
          });

        const db = cli.subcommand("db", { description: "Database" });
        db.command("migrate", {
          default: true,
          description: "Migrate",
          run() {},
        });
        db.command("seed", { description: "Seed", run() {} });

        const terminal = createMemoryTerminal();
        await cli.run(["completions", "fish"], { terminal });
        const scriptFile = join(dir, "mycli.fish");
        writeFileSync(scriptFile, terminal.stdoutText(), "utf8");

        const workDir = join(dir, "work");
        mkdirSync(join(workDir, "sub"), { recursive: true });
        writeFileSync(join(workDir, "a.ts"), "");
        writeFileSync(join(workDir, "b.json"), "");
        writeFileSync(join(workDir, "c.txt"), "");
        writeFileSync(join(workDir, "sub", "d.ts"), "");
        writeFileSync(join(workDir, "sub", "e.txt"), "");

        const runFish = (line: string): string =>
          execFileSync(
            "fish",
            [
              "-c",
              `source ${JSON.stringify(scriptFile)}; complete -C ${JSON.stringify(line)}`,
            ],
            { encoding: "utf8", cwd: workDir },
          ).trim();

        // Static slots: subcommands, alias, enum, flags, rules, delimiter, help, stopParsing
        expect(runFish("mycli ")).toContain("deploy\tDeploy app");
        expect(runFish("mycli ")).not.toContain("\nd\t");
        expect(runFish("mycli d")).toContain("d\tDeploy app");
        expect(runFish("mycli deploy ")).toBe("prod\nstaging");
        expect(runFish("mycli d ")).toBe("prod\nstaging");
        expect(runFish("mycli deploy --tags=v1,l")).toBe("--tags=v1,latest");

        const flagOut = runFish("mycli deploy --json --");

        expect(flagOut).not.toContain("--json");
        expect(flagOut).not.toContain("--yaml");
        expect(flagOut).toContain("--no-cache");

        expect(runFish("mycli deploy prod --")).not.toContain("--all");
        expect(runFish("mycli deploy --all ")).toBe("");
        expect(runFish("mycli help db ")).toBe("migrate\tMigrate\nseed\tSeed");
        expect(runFish("mycli exec git --")).toBe("");

        // Native static file extension & directory filtering in Fish (0 binary calls)
        const fishConfigFiles = runFish("mycli deploy --config ").split("\n");

        expect(fishConfigFiles).toEqual(["a.ts", "b.json", "sub/"]);
        expect(runFish("mycli deploy --config=sub/")).toBe("--config=sub/d.ts");
        expect(runFish("mycli deploy --out-dir ")).toBe("sub/");
        expect(runFish("mycli deploy --out-dir=")).toBe("--out-dir=sub/");

        // Zero binary invocations for all static completions above!
        let callLog = "";
        try {
          callLog = readFileSync(logFile, "utf8");
        } catch {
          callLog = "";
        }

        expect(callLog).toBe("");

        // Dynamic slots: --region flag, service arg, custom stopParsing predicate
        expect(runFish("mycli deploy --region ")).toBe(
          "dyn-item\tDynamic item",
        );
        expect(runFish("mycli deploy --region=")).toBe(
          "--region=dyn-item\tDynamic item",
        );
        expect(runFish("mycli deploy prod ")).toBe("dyn-item\tDynamic item");
        expect(runFish("mycli run prod ")).toBe("dyn-item\tDynamic item");

        const dynamicCalls = readFileSync(logFile, "utf8")
          .trim()
          .split("\n")
          .filter(Boolean);

        expect(dynamicCalls).toHaveLength(4);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(!hasShell("bash"))(
    "executes hybrid Bash completions with 0 binary invocations on static slots and 1 on dynamic slots",
    async () => {
      const dir = mkdtempSync(join(tmpdir(), "clerc-bash-comp-"));
      try {
        const logFile = join(dir, "calls.log");
        const stubBin = join(dir, "stub.sh");
        writeFileSync(
          stubBin,
          `#!/usr/bin/env bash\necho "$*" >> ${JSON.stringify(logFile)}\nprintf "dyn-item\\tDynamic item\\n:4\\n"\n`,
          "utf8",
        );
        chmodSync(stubBin, 0o755);

        const cli = createTestCli({ name: "mycli", version: "1.0.0" })
          .use(completionsPlugin({ executable: stubBin }))
          .command("deploy [env] [service]", {
            aliases: ["d"],
            args: {
              env: Types.Enum("staging", "prod"),
              service: { complete: () => ["api-svc"] },
            },
            flags: {
              all: Boolean,
              json: Boolean,
              yaml: Boolean,
              tags: {
                type: Types.Enum("v1", "v2", "latest"),
                multiple: true,
                delimiter: ",",
              },
              config: {
                type: String,
                complete: Complete.file("ts", "json"),
              },
              outDir: {
                type: String,
                complete: Complete.dir(),
              },
              region: {
                type: String,
                short: "r",
                complete: () => ["us-east-1"],
              },
            },
            rules: ({ exclusive, oneOf, flag, arg }) => [
              exclusive(flag("json"), flag("yaml")),
              oneOf(arg("env"), flag("all")),
            ],
            run() {},
          });

        const db = cli.subcommand("db", { description: "Database" });
        db.command("migrate", { default: true, run() {} });
        db.command("seed", { run() {} });

        const terminal = createMemoryTerminal();
        await cli.run(["completions", "bash"], { terminal });
        const scriptFile = join(dir, "mycli.bash");
        writeFileSync(scriptFile, terminal.stdoutText(), "utf8");

        // Syntax check
        execFileSync("bash", ["-n", scriptFile]);

        const workDir = join(dir, "work");
        mkdirSync(join(workDir, "sub"), { recursive: true });
        writeFileSync(join(workDir, "a.ts"), "");
        writeFileSync(join(workDir, "b.json"), "");
        writeFileSync(join(workDir, "c.txt"), "");
        writeFileSync(join(workDir, "sub", "d.ts"), "");
        writeFileSync(join(workDir, "sub", "e.txt"), "");

        function runBash(words: string[]): string[] {
          const quoted = words
            .map((w) => `'${w.replace(/'/g, "'\\''")}'`)
            .join(" ");
          const out = execFileSync(
            "bash",
            [
              "-c",
              `source ${JSON.stringify(scriptFile)}; COMP_WORDS=(${quoted}); COMP_CWORD=${words.length - 1}; __mycli_complete; printf '%s\\n' "\${COMPREPLY[@]}"`,
            ],
            { encoding: "utf8", cwd: workDir },
          );

          return out.split("\n").filter(Boolean);
        }

        expect(runBash(["mycli", ""])).toContain("deploy");
        expect(runBash(["mycli", ""])).not.toContain("d");
        expect(runBash(["mycli", "d"])).toContain("d");
        expect(runBash(["mycli", "deploy", ""])).toEqual(["staging", "prod"]);
        expect(runBash(["mycli", "deploy", "--tags=v1,l"])).toEqual([
          "--tags=v1,latest",
        ]);
        expect(runBash(["mycli", "deploy", "--json", "--"])).not.toContain(
          "--yaml",
        );
        expect(runBash(["mycli", "deploy", "prod", "--"])).not.toContain(
          "--all",
        );
        expect(runBash(["mycli", "deploy", "--all", ""])).toEqual([]);
        expect(runBash(["mycli", "help", "db", ""])).toEqual([
          "migrate",
          "seed",
        ]);

        // Native static file extension & directory filtering in Bash (0 binary calls)
        expect(runBash(["mycli", "deploy", "--config", ""]).sort()).toEqual([
          "a.ts",
          "b.json",
          "sub",
        ]);
        expect(runBash(["mycli", "deploy", "--config=sub/"])).toEqual([
          "--config=sub/d.ts",
        ]);
        expect(runBash(["mycli", "deploy", "--out-dir", ""])).toEqual(["sub"]);
        expect(runBash(["mycli", "deploy", "--out-dir="])).toEqual([
          "--out-dir=sub",
        ]);

        // Zero binary invocations for static slots!
        let callLog = "";
        try {
          callLog = readFileSync(logFile, "utf8");
        } catch {
          callLog = "";
        }

        expect(callLog).toBe("");

        // Dynamic slots
        expect(runBash(["mycli", "deploy", "--region", ""])).toEqual([
          "dyn-item",
        ]);
        expect(runBash(["mycli", "deploy", "--region="])).toEqual([
          "--region=dyn-item",
        ]);
        expect(runBash(["mycli", "deploy", "prod", ""])).toEqual(["dyn-item"]);

        const dynamicCalls = readFileSync(logFile, "utf8")
          .trim()
          .split("\n")
          .filter(Boolean);

        expect(dynamicCalls).toHaveLength(3);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});
