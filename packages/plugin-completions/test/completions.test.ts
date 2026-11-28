import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createMemoryTerminal, createTestCli } from "@clerc/test-utils";
import { Complete, Types, command, exclusive, middleware, use } from "clerc";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  ShellCompDirective,
  completions,
  detectShell,
  resolveInstallPlan,
} from "../src";

const hasShell = (shell: string): boolean =>
  spawnSync(shell, ["--version"], { stdio: "ignore" }).status === 0;

describe("plugin-completions v2", () => {
  it("generates pure-static zsh, bash, fish, and powershell scripts when no dynamic handlers exist", async () => {
    const terminal = createMemoryTerminal();
    const build = command("build [env]", {
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

    const auth = middleware({
      flags: {
        token: {
          type: String,
          required: true,
          description: "Scoped auth token",
        },
      },
    });
    const [scopedBuild] = use(auth, [build]);

    const app = createTestCli({
      commands: [
        scopedBuild,
        command("internal", { hidden: true, run() {} }),
        completions(),
      ],
      default: scopedBuild,
    });

    for (const shell of ["zsh", "bash", "fish", "powershell"] as const) {
      terminal.clear();
      const res = await app.run(["completions", shell], { terminal });
      const script = terminal.stdoutText();

      expect(res.ok).toBeTruthy();
      expect(script).not.toMatch(/\bcomplete (?:'--'|-- )/);
      expect(script).toContain("build");
      expect(script).toContain("--dry-run");
      expect(script).toContain("--no-cache");
      expect(script).toContain("dev");
      expect(script).toContain("prod");
    }

    terminal.clear();
    await app.run(["completions", "fish"], { terminal });

    expect(terminal.stdoutText()).toContain(
      "function __test_perform_completion",
    );
    expect(terminal.stdoutText()).toContain("set -l shellCompDirectiveError");

    // Works even when global required flags (--token) are not set!
    terminal.clear();
    await app.run(["complete", "--", "--dry"], { terminal });

    expect(terminal.stdoutText()).toBe("--dry-run\tDry run\n:4");

    terminal.clear();
    await app.run(["complete", "--", "build", "--no-"], { terminal });

    expect(terminal.stdoutText()).toContain("--no-cache\tUse cache");
    expect(terminal.stdoutText()).toContain("--no-dry-run\tDry run");

    terminal.clear();
    await app.run(["complete", "--", "b", ""], { terminal });

    expect(terminal.stdoutText()).toBe("dev\nprod\n:4");
  });

  it("supports static declarative complete values on flags, args, and commands without dynamic fallback", async () => {
    const terminal = createMemoryTerminal();
    const app = createTestCli({
      commands: [
        completions(),
        command("deploy [region]", {
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
        }),
        command("open [target]", {
          complete: Complete.list(["alpha", "beta"], {
            keepOrder: true,
            noSpace: true,
          }),
          run() {},
        }),
      ],
    });

    await app.run(["complete", "--", "deploy", "eu"], { terminal });

    expect(terminal.stdoutText()).toBe("eu-west-1\tEurope\n:4");

    terminal.clear();
    await app.run(["complete", "--", "deploy", "--config", ""], { terminal });

    expect(terminal.stdoutText()).toBe(
      `ts\njson\n:${ShellCompDirective.FilterFileExt}`,
    );

    terminal.clear();
    await app.run(["complete", "--", "deploy", "--out-dir", ""], { terminal });

    expect(terminal.stdoutText()).toBe(`:${ShellCompDirective.FilterDirs}`);

    terminal.clear();
    await app.run(["complete", "--", "open", ""], { terminal });

    expect(terminal.stdoutText()).toBe(
      `alpha\nbeta\n:${ShellCompDirective.NoFileComp | ShellCompDirective.KeepOrder | ShellCompDirective.NoSpace}`,
    );

    for (const shell of ["zsh", "bash", "fish", "powershell"] as const) {
      terminal.clear();
      await app.run(["completions", shell], { terminal });
      const script = terminal.stdoutText();

      expect(script).not.toMatch(/\bcomplete (?:'--'|-- )/);
      expect(script).toContain("us-east-1");
      expect(script).toContain("eu-west-1");
      expect(script).toContain("alpha");
    }
  });

  it("completes multi-level subcommand paths for built-in help [command...]", async () => {
    const terminal = createMemoryTerminal();
    const serverMw = middleware({
      flags: { server: { type: String, required: true } },
    });
    const app = createTestCli({
      commands: [
        completions(),
        ...use(serverMw, [
          command("deploy", {
            description: "Deploy application",
            run() {},
          }),
          command("db", {
            description: "Database management",
            commands: [
              command("migrate", {
                description: "Run pending migrations",
                run() {},
              }),
              command("seed", {
                description: "Seed development data",
                run() {},
              }),
            ],
          }),
          command("secret", {
            hidden: true,
            run() {},
          }),
          command("unlisted", {
            complete: false,
            run() {},
          }),
        ]),
      ],
    });

    await app.run(["complete", "--", "help", ""], { terminal });
    const topOut = terminal.stdoutText();

    expect(topOut).toContain("deploy\tDeploy application");
    expect(topOut).toContain("db\tDatabase management");
    expect(topOut).toContain("completions\tGenerate shell completion scripts");
    expect(topOut).not.toContain("secret");
    expect(topOut).not.toContain("unlisted");
    expect(topOut).not.toContain("complete\t");

    terminal.clear();
    await app.run(["complete", "--", "help", "d"], { terminal });

    expect(terminal.stdoutText()).toBe(
      ["deploy\tDeploy application", "db\tDatabase management", ":4"].join(
        "\n",
      ),
    );

    terminal.clear();
    await app.run(["complete", "--", "help", "db", ""], { terminal });

    expect(terminal.stdoutText()).toBe(
      [
        "migrate\tRun pending migrations",
        "seed\tSeed development data",
        ":4",
      ].join("\n"),
    );

    terminal.clear();
    await app.run(["complete", "--", "help", "db", "m"], { terminal });

    expect(terminal.stdoutText()).toBe("migrate\tRun pending migrations\n:4");
  });

  it("supports async custom complete() on commands, args, and flags with typed context and file directives", async () => {
    const terminal = createMemoryTerminal();
    const profileMw = middleware({
      flags: { profile: { type: String, default: "default" } },
    });

    const app = createTestCli({
      use: [profileMw],
      commands: [
        completions(),
        command("deploy <env> <service>", {
          use: [profileMw],
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
        }),
        command("checkout <branch>", {
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
        }),
      ],
    });

    for (const shell of ["zsh", "bash", "fish", "powershell"] as const) {
      terminal.clear();
      const res = await app.run(["completions", shell], { terminal });

      expect(res.ok).toBeTruthy();
      expect(terminal.stdoutText()).toMatch(/\bcomplete (?:'--'|-- )/);
    }

    terminal.clear();
    await app.run(["complete", "--", "deploy", "--region", ""], { terminal });

    expect(terminal.stdoutText()).toBe(
      ["us-east-1\tUS East", "eu-west-1\tEurope", ":4"].join("\n"),
    );

    terminal.clear();
    await app.run(["complete", "--", "deploy", "--region=eu"], { terminal });

    expect(terminal.stdoutText()).toBe("eu-west-1\tEurope\n:4");

    terminal.clear();
    await app.run(["complete", "--", "deploy", "--config", ""], { terminal });

    expect(terminal.stdoutText()).toBe(
      `ts\njson\n:${ShellCompDirective.FilterFileExt}`,
    );

    terminal.clear();
    await app.run(["complete", "--", "deploy", "--tags=v1,l"], { terminal });

    expect(terminal.stdoutText()).toBe("v1,latest\n:4");

    terminal.clear();
    await app.run(["complete", "--", "deploy", "prod", "-r", "eu-west-1", ""], {
      terminal,
    });

    expect(terminal.stdoutText()).toBe("prod-eu-west-1-api\n:4");

    terminal.clear();
    await app.run(["complete", "--", "checkout", ""], { terminal });

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
    const app = createTestCli({ commands: [completions()] });

    const res = await app.run(["completions"], { terminal });

    expect(res.ok).toBeFalsy();
    expect(res.exitCode).toBe(2);
    expect(terminal.stderrText()).toContain(
      "missing required argument '<shell>'",
    );
  });

  it("omits already-used non-repeatable flags and exclusive conflicts, keeps counters/arrays, and parses default command flags", async () => {
    const terminal = createMemoryTerminal();
    const deploy = command("deploy [env]", {
      args: { env: Types.Enum("staging", "prod") },
      flags: [
        {
          port: { type: Number, short: "p", description: "Server port" },
          tags: {
            type: String,
            multiple: true,
            short: "t",
            description: "Tags",
          },
          verbose: { type: Types.Counter, short: "v", description: "Verbose" },
        },
        exclusive(
          { json: { type: Boolean, description: "JSON" } },
          { yaml: { type: Boolean, description: "YAML" } },
        ),
      ],
      run() {},
    });

    const app = createTestCli({
      commands: [completions(), deploy],
      default: deploy,
    });

    await app.run(["complete", "--", "deploy", "--json", "--quiet", "--"], {
      terminal,
    });
    const out = terminal.stdoutText();

    expect(out).not.toContain("--json");
    expect(out).not.toContain("--yaml");
    expect(out).not.toContain("--quiet");
    expect(out).toContain("--tags");
    expect(out).toContain("--verbose");
    expect(out).toContain("--port");

    terminal.clear();
    await app.run(["complete", "--", "-p", "8080", ""], { terminal });

    expect(terminal.stdoutText()).toContain("staging");
    expect(terminal.stdoutText()).toContain("prod");

    terminal.clear();
    await app.run(["complete", "--", "deploy", "--json", "-p", ""], {
      terminal,
    });

    expect(terminal.stdoutText()).toBe(":4");
  });

  it("stops flag completion once stopParsing triggers for presets and predicates", async () => {
    const terminal = createMemoryTerminal();
    const app = createTestCli({
      commands: [
        completions(),
        command("exec <cmd> [args...]", {
          stopParsing: "first-positional",
          flags: { quiet: { type: Boolean, short: "q", description: "Quiet" } },
          run() {},
        }),
        command("dev [args...]", {
          stopParsing: "unknown-flag",
          flags: { config: { type: String, description: "Config file" } },
          run() {},
        }),
        command("run <env> <script> [args...]", {
          stopParsing: (token) =>
            token.kind === "positional" && token.positionalCount === 1,
          flags: { verbose: { type: Boolean, description: "Verbose" } },
          run() {},
        }),
      ],
    });

    await app.run(["complete", "--", "exec", "--"], { terminal });

    expect(terminal.stdoutText()).toContain("--quiet");

    terminal.clear();
    await app.run(["complete", "--", "exec", "git", "--"], { terminal });

    expect(terminal.stdoutText()).toBe(":4");

    terminal.clear();
    await app.run(["complete", "--", "dev", "--"], { terminal });

    expect(terminal.stdoutText()).toContain("--config");

    terminal.clear();
    await app.run(["complete", "--", "dev", "--watch", "--"], { terminal });

    expect(terminal.stdoutText()).toBe(":4");

    terminal.clear();
    await app.run(["complete", "--", "run", "prod", "--"], { terminal });

    expect(terminal.stdoutText()).toContain("--verbose");

    terminal.clear();
    await app.run(["complete", "--", "run", "prod", "app.ts", "--"], {
      terminal,
    });

    expect(terminal.stdoutText()).toBe(":4");
  });

  it("completes scoped flags and subcommands when scoped flags precede subcommand names", async () => {
    const terminal = createMemoryTerminal();
    const prLs = command("ls", { description: "List PRs", run() {} });
    const pr = command("pr", {
      description: "Manage pull requests",
      flags: {
        repo: {
          type: String,
          short: "R",
          description: "Target repository",
        },
      },
      commands: [
        prLs,
        command("merge <id>", { description: "Merge PR", run() {} }),
      ],
      default: prLs,
    });

    const app = createTestCli({ commands: [completions(), pr] });

    await app.run(["complete", "--", "pr", "--repo", "org/app", ""], {
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

        const migrate = command("migrate", {
          description: "Migrate",
          run() {},
        });
        const db = command("db", {
          description: "Database",
          commands: [
            migrate,
            command("seed", { description: "Seed", run() {} }),
          ],
          default: migrate,
        });

        const app = createTestCli({
          name: "mycli",
          version: "1.0.0",
          commands: [
            completions({ executable: stubBin }),
            command("deploy [env] [service]", {
              aliases: ["d"],
              description: "Deploy app",
              args: {
                env: Types.Enum("staging", "prod"),
                service: {
                  complete: () => ["api-svc"],
                },
              },
              flags: [
                {
                  cache: {
                    type: Boolean,
                    default: true,
                    description: "Use cache",
                  },
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
                exclusive(
                  { json: { type: Boolean, description: "JSON" } },
                  { yaml: { type: Boolean, description: "YAML" } },
                ),
              ],
              run() {},
            }),
            command("exec <cmd> [args...]", {
              stopParsing: "first-positional",
              flags: { quiet: Boolean },
              run() {},
            }),
            command("run <env> [args...]", {
              stopParsing: (token) => token.kind === "positional",
              flags: { verbose: Boolean },
              run() {},
            }),
            db,
          ],
        });

        const terminal = createMemoryTerminal();
        await app.run(["completions", "fish"], { terminal });
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

        expect(runFish("mycli help db ")).toBe("migrate\tMigrate\nseed\tSeed");
        expect(runFish("mycli exec git --")).toBe("");

        const fishConfigFiles = runFish("mycli deploy --config ").split("\n");

        expect(fishConfigFiles).toEqual(["a.ts", "b.json", "sub/"]);
        expect(runFish("mycli deploy --config=sub/")).toBe("--config=sub/d.ts");
        expect(runFish("mycli deploy --out-dir ")).toBe("sub/");
        expect(runFish("mycli deploy --out-dir=")).toBe("--out-dir=sub/");

        let callLog = "";
        try {
          callLog = readFileSync(logFile, "utf8");
        } catch {
          callLog = "";
        }

        expect(callLog).toBe("");

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

        const migrate = command("migrate", { run() {} });
        const db = command("db", {
          description: "Database",
          commands: [migrate, command("seed", { run() {} })],
          default: migrate,
        });

        const app = createTestCli({
          name: "mycli",
          version: "1.0.0",
          commands: [
            completions({ executable: stubBin }),
            command("deploy [env] [service]", {
              aliases: ["d"],
              args: {
                env: Types.Enum("staging", "prod"),
                service: { complete: () => ["api-svc"] },
              },
              flags: [
                {
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
                exclusive({ json: Boolean }, { yaml: Boolean }),
              ],
              run() {},
            }),
            db,
          ],
        });

        const terminal = createMemoryTerminal();
        await app.run(["completions", "bash"], { terminal });
        const scriptFile = join(dir, "mycli.bash");
        writeFileSync(scriptFile, terminal.stdoutText(), "utf8");

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
        expect(runBash(["mycli", "help", "db", ""])).toEqual([
          "migrate",
          "seed",
        ]);

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

        let callLog = "";
        try {
          callLog = readFileSync(logFile, "utf8");
        } catch {
          callLog = "";
        }

        expect(callLog).toBe("");

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

  it("installs and uninstalls shell completions idempotently across shells with auto-detection and --dry-run", async () => {
    expect(detectShell({ SHELL: "/usr/bin/fish" })).toBe("fish");
    expect(detectShell({ SHELL: "/bin/zsh" })).toBe("zsh");
    expect(detectShell({ SHELL: "/bin/bash" })).toBe("bash");
    expect(
      detectShell({ SHELL: "C:\\Program Files\\PowerShell\\7\\pwsh.exe" }),
    ).toBe("powershell");
    expect(detectShell({ PSModulePath: "C:\\Modules" })).toBe("powershell");
    expect(detectShell({})).toBeUndefined();

    const dir = mkdtempSync(join(tmpdir(), "clerc-install-comp-"));
    try {
      const auth = middleware({
        flags: { token: { type: String, required: true } },
      });
      const app = createTestCli({
        name: "acme",
        version: "1.0.0",
        commands: [
          completions(),
          use(auth, command("deploy", { description: "Deploy app", run() {} })),
        ],
      });

      const compTerm = createMemoryTerminal();
      await app.run(["complete", "--", "completions", ""], {
        terminal: compTerm,
      });

      expect(compTerm.stdoutText()).toContain(
        "install\tInstall shell completions",
      );
      expect(compTerm.stdoutText()).toContain(
        "uninstall\tRemove installed shell completions",
      );
      expect(compTerm.stdoutText()).toContain("fish");
      expect(compTerm.stdoutText()).toContain("zsh");

      const noShellTerm = createMemoryTerminal({ env: {} });
      const noShellRes = await app.run(["completions", "install"], {
        terminal: noShellTerm,
      });

      expect(noShellRes.ok).toBeFalsy();
      expect(noShellRes.exitCode).toBe(1);
      expect(noShellTerm.stderrText()).toContain(
        "could not detect shell from environment",
      );

      const fishEnv = {
        HOME: dir,
        XDG_CONFIG_HOME: join(dir, "xdg-config"),
        SHELL: "/usr/bin/fish",
      };
      const fishTerm = createMemoryTerminal({ env: fishEnv });
      const dryRes = await app.run(["completions", "install", "--dry-run"], {
        terminal: fishTerm,
      });
      const fishScript = join(
        dir,
        "xdg-config",
        "fish",
        "completions",
        "acme.fish",
      );

      expect(dryRes.ok).toBeTruthy();
      expect(existsSync(fishScript)).toBeFalsy();
      expect(fishTerm.stdoutText()).toContain(fishScript);

      fishTerm.clear();
      const fishInstallRes = await app.run(["completions", "install"], {
        terminal: fishTerm,
      });

      expect(fishInstallRes.ok).toBeTruthy();
      expect(readFileSync(fishScript, "utf8")).toContain(
        "# fish completion for acme",
      );
      expect(
        existsSync(join(dir, "xdg-config", "fish", "config.fish")),
      ).toBeFalsy();

      fishTerm.clear();
      const fishUninstallRes = await app.run(["completions", "uninstall"], {
        terminal: fishTerm,
      });

      expect(fishUninstallRes.ok).toBeTruthy();
      expect(existsSync(fishScript)).toBeFalsy();

      fishTerm.clear();
      const fishUninstallAgain = await app.run(["completions", "uninstall"], {
        terminal: fishTerm,
      });

      expect(fishUninstallAgain.ok).toBeTruthy();
      expect(fishTerm.stdoutText()).toContain("No fish completions found");

      const zshDir = join(dir, "zdot");
      const zshRc = join(zshDir, ".zshrc");
      mkdirSync(zshDir, { recursive: true });
      writeFileSync(zshRc, "export EDITOR=nvim\n", "utf8");
      const zshEnv = {
        HOME: dir,
        XDG_DATA_HOME: join(dir, "xdg-data"),
        ZDOTDIR: zshDir,
      };
      const zshTerm = createMemoryTerminal({ env: zshEnv });

      await app.run(["completions", "install", "zsh"], { terminal: zshTerm });
      await app.run(["completions", "install", "zsh"], { terminal: zshTerm });

      const zshScript = join(dir, "xdg-data", "zsh", "site-functions", "_acme");
      const zshRcAfterInstall = readFileSync(zshRc, "utf8");

      expect(readFileSync(zshScript, "utf8")).toContain("#compdef acme");
      expect(
        zshRcAfterInstall.match(/# >>> acme completions >>>/g),
      ).toHaveLength(1);
      expect(zshRcAfterInstall).toContain("export EDITOR=nvim");

      await app.run(["completions", "uninstall", "zsh"], { terminal: zshTerm });

      expect(existsSync(zshScript)).toBeFalsy();
      expect(readFileSync(zshRc, "utf8")).toBe("export EDITOR=nvim\n");

      const bashHome = join(dir, "bash-home");
      const bashRc = join(bashHome, ".bashrc");
      mkdirSync(bashHome, { recursive: true });
      writeFileSync(bashRc, "alias ll='ls -la'\n", "utf8");
      const bashEnv = {
        HOME: bashHome,
        XDG_DATA_HOME: join(bashHome, ".local", "share"),
      };
      const bashTerm = createMemoryTerminal({ env: bashEnv });

      await app.run(["completions", "install", "bash"], { terminal: bashTerm });
      const bashPlan = resolveInstallPlan("bash", "acme", {
        env: bashEnv,
      });

      expect(readFileSync(bashPlan.scriptPath, "utf8")).toContain(
        "# bash completion for acme",
      );
      expect(readFileSync(bashPlan.rcPath!, "utf8")).toContain(
        "# >>> acme completions >>>",
      );

      if (hasShell("bash")) {
        execFileSync("bash", ["-n", bashPlan.rcPath!]);
        execFileSync("bash", ["-n", bashPlan.scriptPath]);
      }

      await app.run(["completions", "uninstall", "bash"], {
        terminal: bashTerm,
      });

      expect(existsSync(bashPlan.scriptPath)).toBeFalsy();
      expect(readFileSync(bashPlan.rcPath!, "utf8")).toBe(
        "alias ll='ls -la'\n",
      );

      const psProfile = join(dir, "ps", "Microsoft.PowerShell_profile.ps1");
      const psEnv = { HOME: dir, PROFILE: psProfile };
      const psTerm = createMemoryTerminal({ env: psEnv });

      await app.run(["completions", "install", "powershell"], {
        terminal: psTerm,
      });

      const psScript = join(dir, "ps", "completions", "acme.ps1");

      expect(readFileSync(psScript, "utf8")).toContain(
        "Register-ArgumentCompleter",
      );
      expect(readFileSync(psProfile, "utf8")).toContain("Test-Path");

      await app.run(["completions", "uninstall", "powershell"], {
        terminal: psTerm,
      });

      expect(existsSync(psScript)).toBeFalsy();
      expect(readFileSync(psProfile, "utf8")).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
