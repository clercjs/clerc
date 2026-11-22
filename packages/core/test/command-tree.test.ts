import { createMemoryTerminal, createTestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { CommandTree, InvalidCommandError, defineCommand } from "../src";

describe("CommandTree", () => {
  it("resolves nested subcommands and space-delimited subcommands", async () => {
    const called: string[] = [];
    const terminal = createMemoryTerminal();

    const dbCmd = defineCommand({
      name: "db",
      description: "Database commands",
      subcommands: [
        defineCommand({
          name: "migrate",
          aliases: ["m"],
          description: "Run migrations",
          run: (ctx) => {
            called.push(`migrate:${ctx.calledAs}`);
          },
        }),
      ],
    });

    const cli = createTestBaseCli()
      .command(dbCmd)
      .command("db seed", {
        description: "Seed database",
        run: (ctx) => {
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
  });

  it("resolves subcommands even when leading global flags precede the command", async () => {
    let observed:
      { verbose: boolean; config?: string; target: string } | undefined;
    const terminal = createMemoryTerminal();

    const cli = createTestBaseCli()
      .globalFlag("verbose", { type: Boolean, short: "v" })
      .globalFlag("config", { type: String, short: "c" })
      .command("deploy", {
        parameters: ["<target>"] as const,
        run: (ctx) => {
          observed = {
            verbose: ctx.flags.verbose,
            config: ctx.flags.config,
            target: ctx.parameters.target,
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
    const tree = new CommandTree();
    tree.register({ name: "build", aliases: ["b", "compile"] });
    tree.register({ name: "dev", aliases: ["d"] });

    const children = tree.listChildren();

    expect(children.map((n) => n.name)).toEqual(["build", "dev"]);
  });

  it("throws InvalidCommandError on duplicate commands or conflicting aliases", () => {
    const tree = new CommandTree();
    tree.register({ name: "build", aliases: ["b"] });

    expect(() => tree.register({ name: "build" })).toThrow(InvalidCommandError);
    expect(() => tree.register({ name: "b" })).toThrow(InvalidCommandError);
    expect(() => tree.register({ name: "bundle", aliases: ["b"] })).toThrow(
      InvalidCommandError,
    );
  });

  it("supports root command and root alias", async () => {
    const seen: string[] = [];
    const terminal = createMemoryTerminal();

    const cli = createTestBaseCli().command("build", {
      aliases: [""],
      run: (ctx) => {
        seen.push(ctx.calledAs);
      },
    });

    await cli.run([], { terminal });
    await cli.run(["build"], { terminal });

    expect(seen).toEqual(["", "build"]);
  });
});
