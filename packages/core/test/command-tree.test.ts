import { createMemoryTerminal, createTestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import type { AnyCommandDefinition } from "../src";
import { CommandTree, InvalidCommandError, plugin } from "../src";

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

    const cli = createTestBaseCli().use(dbPlugin);
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
    const tree = new CommandTree();
    tree.register(makeDef("build", ["b", "compile"]));
    tree.register(makeDef("dev", ["d"]));

    const children = tree.listChildren();

    expect(children.map((n) => n.name)).toEqual(["build", "dev"]);
  });

  it("throws InvalidCommandError on duplicate commands or conflicting aliases", () => {
    const tree = new CommandTree();
    tree.register(makeDef("build", ["b"]));

    expect(() => tree.register(makeDef("build"))).toThrow(InvalidCommandError);
    expect(() => tree.register(makeDef("b"))).toThrow(InvalidCommandError);
    expect(() => tree.register(makeDef("bundle", ["b"]))).toThrow(
      InvalidCommandError,
    );
  });

  it("supports root command and root alias", async () => {
    const seen: string[] = [];
    const terminal = createMemoryTerminal();

    const cli = createTestBaseCli();
    cli.command("build", {
      aliases: [""],
      run(ctx) {
        seen.push(ctx.calledAs);
      },
    });

    await cli.run([], { terminal });
    await cli.run(["build"], { terminal });

    expect(seen).toEqual(["", "build"]);
  });
});
