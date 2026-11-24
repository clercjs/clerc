import {
  createMemoryTerminal,
  createTestBaseCli,
  createTestCli,
} from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import type { AnyCommandDefinition } from "../src";
import { InvalidSchemaError, UnknownCommandError, clerc, plugin } from "../src";
import { CommandTreeBuilder } from "../src/command-tree";

const makeDef = (
  name: string,
  aliases?: string | string[],
): AnyCommandDefinition => ({
  spec: name,
  name,
  argTokens: [],
  aliases,
});

describe("CommandTree", () => {
  it("resolves space-delimited subcommands and plugin-composed namespaces", async () => {
    const called: string[] = [];
    const terminal = createMemoryTerminal();

    const dbPlugin = plugin("db")
      .command("db", { description: "Database commands" })
      .command("db migrate", {
        aliases: "m",
        description: "Run migrations",
        run(ctx) {
          called.push(`migrate:${ctx.calledAs}`);
        },
      });

    const cli = createTestCli().use(dbPlugin);
    cli.command("db seed", {
      description: "Seed database",
      run(ctx) {
        called.push(`seed:${ctx.calledAs}`);
      },
    });

    await cli.run(["db", "migrate"], { terminal });
    await cli.run(["db", "m"], { terminal });
    await cli.run(["db", "seed"], { terminal });

    expect(called).toEqual([
      "migrate:db migrate",
      "migrate:db m",
      "seed:db seed",
    ]);

    // A metadata-only parent command (no run) behaves as a namespace
    const helpTerm = createMemoryTerminal();
    const nsRes = await cli.run(["db"], { terminal: helpTerm });

    expect(nsRes.ok).toBeTruthy();
    expect(helpTerm.stdoutText()).toContain("Database commands");
    expect(helpTerm.stdoutText()).toContain("db <command>");
    expect(helpTerm.stdoutText()).toContain("migrate");

    const typoTerm = createMemoryTerminal();
    const typoRes = await cli.run(["db", "migrat"], { terminal: typoTerm });

    expect(typoRes.ok).toBeFalsy();
    expect(typoTerm.stderrText()).toContain("db migrate");
  });

  it("resolves subcommands even when leading global flags precede the command", async () => {
    let observed:
      { verbose: boolean; config?: string; target: string } | undefined;
    const terminal = createMemoryTerminal();

    const cli = createTestBaseCli().flags({
      verbose: { type: Boolean, short: "v" },
      config: { type: String, short: "c" },
    });

    cli.command("deploy <target>", {
      run(ctx) {
        observed = {
          verbose: ctx.flags.verbose,
          config: ctx.flags.config,
          target: ctx.args.target,
        };
      },
    });

    await cli.run(["-v", "--config", "app.json", "deploy", "prod"], {
      terminal,
    });

    expect(observed).toEqual({
      verbose: true,
      config: "app.json",
      target: "prod",
    });

    await cli.run(["--config=other.json", "deploy", "staging"], { terminal });

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

  it("supports spec-less command(options) root command and rejects empty string specs or aliases", async () => {
    const seen: string[] = [];
    const terminal = createMemoryTerminal();

    const cli = createTestBaseCli();
    cli.command({
      flags: { port: { type: Number, default: 3000 } },
      run(ctx) {
        seen.push(`root:${ctx.calledAs}:${ctx.flags.port}`);
      },
    });
    cli.command("build", {
      run(ctx) {
        seen.push(`sub:${ctx.calledAs}`);
      },
    });

    await cli.run([], { terminal });
    await cli.run(["--port", "8080"], { terminal });
    await cli.run(["build"], { terminal });

    expect(seen).toEqual(["root::3000", "root::8080", "sub:build"]);

    expect(() => (cli.command as any)("", { run() {} })).toThrow(
      InvalidSchemaError,
    );
    expect(() => (cli.command as any)("   ", { run() {} })).toThrow(
      InvalidSchemaError,
    );

    const tree = new CommandTreeBuilder();

    expect(() => tree.register(makeDef("build", [""]))).toThrow(
      InvalidSchemaError,
    );
  });

  it("supports clerc({ defaultCommand }) with smart positional routing and help tags", async () => {
    // 1. defaultCommand without positional args keeps UnknownCommandError + typo hints
    const events: string[] = [];
    const noArgCli = clerc({
      name: "vite",
      version: "1.0.0",
      defaultCommand: "dev",
    });
    noArgCli.command("dev", {
      description: "Start dev server",
      flags: { port: { type: Number, short: "p", default: 5173 } },
      run(ctx) {
        events.push(`dev:${ctx.flags.port}`);
      },
    });
    noArgCli.command("build", {
      description: "Build app",
      run() {
        events.push("build");
      },
    });

    const term = createMemoryTerminal();
    await noArgCli.run([], { terminal: term });
    await noArgCli.run(["-p", "8080"], { terminal: term });

    expect(events).toEqual(["dev:5173", "dev:8080"]);

    // Typo 'biuld' still reports UnknownCommandError with 'build' suggestion
    const typoRes = await noArgCli.run(["biuld"], { terminal: term });

    expect(typoRes.ok).toBeFalsy();
    expect(typoRes.error).toBeInstanceOf(UnknownCommandError);
    expect(term.stderrText()).toContain("a similar command exists: 'build'");

    // Root --help and --version still work at root and mark [default]
    term.clear();
    await noArgCli.run(["--version"], { terminal: term });

    expect(term.stdoutText()).toBe("vite v1.0.0");

    term.clear();
    await noArgCli.run(["--help"], { terminal: term });

    expect(term.stdoutText()).toContain("USAGE   vite [command] [options]");
    expect(term.stdoutText()).toContain("Start dev server  [default]");

    // 2. defaultCommand with positional args forwards unmatched root args like Vite
    const dirEvents: string[] = [];
    const argCli = clerc({
      name: "vite",
      version: "1.0.0",
      defaultCommand: "dev",
    });
    argCli.command("dev [dir]", {
      flags: { port: { type: Number, short: "p", default: 5173 } },
      run(ctx) {
        dirEvents.push(`dev:${ctx.args.dir ?? "."}:${ctx.flags.port}`);
      },
    });
    argCli.command("build", {
      run() {
        dirEvents.push("build");
      },
    });
    argCli.command("db migrate", { run() {} });

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

    // Subcommand namespace typos ('vite db migrat') still report UnknownCommandError
    await expect(
      argCli.run(["db", "migrat"], { terminal: term, throwOnError: true }),
    ).rejects.toThrow(UnknownCommandError);

    // 3. Compile-time validation rejects missing, namespace-only, or conflicting defaultCommand
    const missingDefault = clerc({
      name: "vite",
      defaultCommand: "missing",
    });
    missingDefault.command("build", { run() {} });

    expect(() => missingDefault.buildModel()).toThrow(InvalidSchemaError);

    const nsDefault = clerc({ name: "vite", defaultCommand: "db" });
    nsDefault.command("db migrate", { run() {} });

    expect(() => nsDefault.buildModel()).toThrow(InvalidSchemaError);

    const conflictDefault = clerc({
      name: "vite",
      defaultCommand: "dev",
    });
    conflictDefault.command({ run() {} });
    conflictDefault.command("dev", { run() {} });

    expect(() => conflictDefault.buildModel()).toThrow(InvalidSchemaError);
  });
});
