import {
  createMemoryTerminal,
  createTestBaseCli,
  createTestCli,
} from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import type { Command } from "../src";
import { InvalidSchemaError, UnknownCommandError, cli, command } from "../src";
import { COMMAND_ID, COMMAND_NODE } from "../src/command";
import { CommandTreeBuilder } from "../src/command-tree";

const makeDef = (name: string, aliases?: string | string[]): Command => ({
  [COMMAND_NODE]: true,
  [COMMAND_ID]: Symbol(name),
  spec: name,
  name,
  argTokens: [],
  aliases,
});

describe("CommandTree", () => {
  it("resolves nested subcommands and space-delimited command specs", async () => {
    const called: string[] = [];
    const terminal = createMemoryTerminal();

    const db = command("db", {
      description: "Database commands",
      commands: [
        command("migrate", {
          aliases: "m",
          description: "Run migrations",
          run(ctx) {
            called.push(`migrate:${ctx.calledAs}`);
          },
        }),
        command("seed", {
          description: "Seed database",
          run(ctx) {
            called.push(`seed:${ctx.calledAs}`);
          },
        }),
      ],
    });

    const app = createTestCli({ commands: [db] });

    await app.run(["db", "migrate"], { terminal });
    await app.run(["db", "m"], { terminal });
    await app.run(["db", "seed"], { terminal });

    expect(called).toEqual([
      "migrate:db migrate",
      "migrate:db m",
      "seed:db seed",
    ]);

    const helpTerm = createMemoryTerminal();
    const nsRes = await app.run(["db"], { terminal: helpTerm });

    expect(nsRes.ok).toBeTruthy();
    expect(helpTerm.stdoutText()).toContain("Database commands");
    expect(helpTerm.stdoutText()).toContain("db <command>");
    expect(helpTerm.stdoutText()).toContain("migrate");

    const typoTerm = createMemoryTerminal();
    const typoRes = await app.run(["db", "migrat"], { terminal: typoTerm });

    expect(typoRes.ok).toBeFalsy();
    expect(typoTerm.stderrText()).toContain("db migrate");
  });

  it("resolves subcommands even when leading global flags precede the command", async () => {
    let observed:
      { verbose: boolean; config?: string; target: string } | undefined;
    const terminal = createMemoryTerminal();

    const app = createTestBaseCli({
      flags: {
        verbose: { type: Boolean, short: "v" },
        config: { type: String, short: "c" },
      },
      commands: [
        command("deploy <target>", {
          run(ctx) {
            const flags = ctx.flags as { verbose: boolean; config?: string };
            observed = {
              verbose: flags.verbose,
              config: flags.config,
              target: ctx.args.target,
            };
          },
        }),
      ],
    });

    await app.run(["-v", "--config", "app.json", "deploy", "prod"], {
      terminal,
    });

    expect(observed).toEqual({
      verbose: true,
      config: "app.json",
      target: "prod",
    });

    await app.run(["--config=other.json", "deploy", "staging"], { terminal });

    expect(observed).toEqual({
      verbose: false,
      config: "other.json",
      target: "staging",
    });
  });

  it("lists canonical children without leaking aliases", () => {
    const tree = new CommandTreeBuilder();
    tree.register(makeDef("build", ["b", "compile"]));
    tree.register(makeDef("dev", ["d"]));

    const children = tree.listChildren();

    expect(children.map((n) => n.name)).toEqual(["build", "dev"]);
  });

  it("throws InvalidSchemaError on duplicate commands or conflicting aliases", () => {
    const tree = new CommandTreeBuilder();
    tree.register(makeDef("build", ["b"]));

    expect(() => tree.register(makeDef("build"))).toThrow(InvalidSchemaError);
    expect(() => tree.register(makeDef("b"))).toThrow(InvalidSchemaError);
    expect(() => tree.register(makeDef("bundle", ["b"]))).toThrow(
      InvalidSchemaError,
    );

    tree.register(makeDef(""));

    expect(() => tree.register(makeDef(""))).toThrow(
      "root command already exists",
    );
  });

  it("supports single-command cli(spec, options), root cli({ run }), and rejects empty specs or aliases", async () => {
    const seen: string[] = [];
    const terminal = createMemoryTerminal();

    const app = createTestBaseCli({
      flags: { port: { type: Number, default: 3000 } },
      commands: [
        command("build", {
          run(ctx) {
            seen.push(`sub:${ctx.calledAs}`);
          },
        }),
      ],
      run(ctx) {
        seen.push(`root:${ctx.calledAs}:${ctx.flags.port}`);
      },
    });

    await app.run([], { terminal });
    await app.run(["--port", "8080"], { terminal });
    await app.run(["build"], { terminal });

    expect(seen).toEqual(["root::3000", "root::8080", "sub:build"]);

    const singleCli = cli("[files...]", {
      name: "bumpp",
      help: false,
      verbosity: false,
      flags: { yes: { type: Boolean, short: "y" } },
      run(ctx) {
        seen.push(`bumpp:${ctx.args.files.join(",")}:${String(ctx.flags.yes)}`);
      },
    });
    await singleCli.run(["a.json", "b.json", "-y"], { terminal });

    expect(seen.at(-1)).toBe("bumpp:a.json,b.json:true");

    expect(() => (command as any)("", { run() {} })).toThrow(
      InvalidSchemaError,
    );
    expect(() => (command as any)("   ", { run() {} })).toThrow(
      InvalidSchemaError,
    );
    expect(() => cli("deploy <env>", { run() {} })).toThrow(InvalidSchemaError);

    const tree = new CommandTreeBuilder();

    expect(() => tree.register(makeDef("build", [""]))).toThrow(
      InvalidSchemaError,
    );
  });

  it("supports default: commandObject on root cli and subcommand namespaces with auto-dedup and smart routing", async () => {
    const events: string[] = [];
    const devNoArgs = command("dev", {
      description: "Start dev server",
      flags: { port: { type: Number, short: "p", default: 5173 } },
      run(ctx) {
        events.push(`dev:${ctx.flags.port}`);
      },
    });
    const buildCmd = command("build", {
      description: "Build app",
      run() {
        events.push("build");
      },
    });

    // Notice devNoArgs is passed to default AND omitted from commands (auto-included!)
    const noArgCli = cli({
      name: "vite",
      version: "1.0.0",
      commands: [buildCmd],
      default: devNoArgs,
    });

    const term = createMemoryTerminal();
    await noArgCli.run([], { terminal: term });
    await noArgCli.run(["-p", "8080"], { terminal: term });

    expect(events).toEqual(["dev:5173", "dev:8080"]);

    const typoRes = await noArgCli.run(["biuld"], { terminal: term });

    expect(typoRes.ok).toBeFalsy();
    expect(typoRes.error).toBeInstanceOf(UnknownCommandError);
    expect(term.stderrText()).toContain("a similar command exists: 'build'");

    term.clear();
    await noArgCli.run(["--version"], { terminal: term });

    expect(term.stdoutText()).toBe("vite v1.0.0");

    term.clear();
    await noArgCli.run(["--help"], { terminal: term });

    expect(term.stdoutText()).toContain("USAGE\n  vite [command] [options]");
    expect(term.stdoutText()).toContain("Start dev server  [default]");

    const dirEvents: string[] = [];
    const devWithArgs = command("dev [dir]", {
      flags: { port: { type: Number, short: "p", default: 5173 } },
      run(ctx) {
        dirEvents.push(`dev:${ctx.args.dir ?? "."}:${ctx.flags.port}`);
      },
    });
    const argCli = cli({
      name: "vite",
      version: "1.0.0",
      commands: [
        devWithArgs,
        command("build", {
          run() {
            dirEvents.push("build");
          },
        }),
        command("db migrate", { run() {} }),
      ],
      default: devWithArgs,
    });

    await argCli.run([], { terminal: term });
    await argCli.run(["./my-app", "-p", "3000"], { terminal: term });
    await argCli.run(["dev", "./web"], { terminal: term });
    await argCli.run(["build"], { terminal: term });

    expect(dirEvents).toEqual([
      "dev:.:5173",
      "dev:./my-app:3000",
      "dev:./web:5173",
      "build",
    ]);

    await expect(
      argCli.run(["db", "migrat"], { terminal: term, throwOnError: true }),
    ).rejects.toThrow(UnknownCommandError);

    // Schema validation for default commands
    const nonRunnable = command("db", {});

    expect(() =>
      cli({ name: "vite", default: nonRunnable }).buildModel(),
    ).toThrow(InvalidSchemaError);

    expect(() =>
      (command as any)("node", { default: devNoArgs, run() {} }),
    ).toThrow(InvalidSchemaError);

    expect(() =>
      (cli as any)({ name: "vite", default: devNoArgs, run() {} }),
    ).toThrow(InvalidSchemaError);
  });
});
