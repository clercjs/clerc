import { TestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { defineCommand } from "../src";

describe("commands", () => {
  it("should have exact one command", () => {
    expect(() => {
      // @ts-expect-error testing
      TestBaseCli().command("foo", "foo").command("foo", "foo");
    }).toThrowError();
  });

  it("should parse nested command", () => {
    TestBaseCli()
      .command("foo bar", "foo bar", {
        flags: {
          aa: {
            type: Boolean,
            description: "aa",
            default: false,
          },
        },
        parameters: ["<param>"],
      })
      .on("foo bar", (ctx) => {
        expect(ctx.flags.aa).toBeTruthy();
        expect(ctx.parameters.param).toBe("param");
      })
      .parse(["foo", "bar", "--aa", "param"]);
  });

  it("shouldn't parse nested command when parent command is called", () => {
    TestBaseCli()
      .command("foo bar", "foo bar", {
        flags: {
          aa: {
            type: Boolean,
            description: "aa",
            default: false,
          },
        },
      })
      .command("foo", "foo", {
        flags: {
          bb: {
            type: Boolean,
            description: "bb",
            default: false,
          },
        },
        parameters: ["<param>"],
      })
      .on("foo", (ctx) => {
        expect(ctx.flags.bb).toBeTruthy();
        expect(ctx.parameters.param).toBe("param");
      })
      .parse(["foo", "--bb", "param"]);
  });

  it("shouldn't parse when command is after command", () => {
    TestBaseCli()
      .command("foo bar", "foo bar", {
        flags: {
          aa: {
            description: "aa",
            type: Boolean,
            default: false,
          },
        },
      })
      .command("foo", "foo", {
        flags: {
          bb: {
            description: "bb",
            type: Boolean,
            default: false,
          },
        },
        parameters: ["<param>"],
      })
      .on("foo", (ctx) => {
        expect(ctx.flags.bb).toBeTruthy();
        expect(ctx.parameters.param).toBe("bar");
      })
      .parse(["foo", "--bb", "bar"]);
  });

  it("should parse subcommand", () => {
    TestBaseCli()
      .command("foo bar", "foo")
      .on("foo bar", (ctx) => {
        expect(ctx.command.name).toBe("foo bar");
        expect(ctx.rawParsed).toMatchInlineSnapshot(`
          {
            "doubleDash": [],
            "flags": {},
            "ignored": [],
            "missingRequiredFlags": [],
            "parameters": [],
            "raw": [],
            "rawUnknown": [],
            "unknown": {},
          }
        `);
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags).toMatchInlineSnapshot("{}");
      })
      .parse(["foo", "bar"]);
  });

  it("should register command with handler", () => {
    let count = 0;
    const command = defineCommand(
      {
        name: "foo",
        description: "foo",
      },
      () => {
        count++;
      },
    );
    TestBaseCli().command(command).parse(["foo"]);

    expect(count).toBe(1);
  });

  it("should resolve alias from command object", async () => {
    await expect(
      TestBaseCli()
        .command({
          name: "foo",
          description: "foo",
          alias: "bar",
          handler: (ctx) => {
            expect(ctx.command.name).toBe("foo");
          },
        })
        .parse(["bar"]),
    ).resolves.not.toThrowError();
  });

  it("should register multiple commands with array form", () => {
    let fooCount = 0;
    let barCount = 0;
    let bazCount = 0;

    const commands = [
      {
        name: "foo",
        description: "foo command",
        handler: () => {
          fooCount++;
        },
      },
      {
        name: "bar",
        description: "bar command",
        flags: {
          test: {
            type: Boolean,
            default: false,
          },
        },
        handler: () => {
          barCount++;
        },
      },
      {
        name: "baz",
        description: "baz command",
        parameters: ["<param>"],
        handler: () => {
          bazCount++;
        },
      },
    ];

    TestBaseCli().command(commands).parse(["foo"]);

    expect(fooCount).toBe(1);
    expect(barCount).toBe(0);
    expect(bazCount).toBe(0);

    TestBaseCli().command(commands).parse(["bar"]);

    expect(fooCount).toBe(1);
    expect(barCount).toBe(1);
    expect(bazCount).toBe(0);

    TestBaseCli().command(commands).parse(["baz", "test"]);

    expect(fooCount).toBe(1);
    expect(barCount).toBe(1);
    expect(bazCount).toBe(1);
  });

  it("should register multiple commands with array form using defineCommand", () => {
    let count1 = 0;
    let count2 = 0;

    const commands = [
      defineCommand(
        {
          name: "cmd1",
          description: "Command 1",
        },
        () => {
          count1++;
        },
      ),
      defineCommand(
        {
          name: "cmd2",
          description: "Command 2",
          flags: {
            flag: {
              type: Boolean,
              default: false,
            },
          },
        },
        () => {
          count2++;
        },
      ),
    ];

    TestBaseCli().command(commands).parse(["cmd1"]);

    expect(count1).toBe(1);
    expect(count2).toBe(0);

    TestBaseCli().command(commands).parse(["cmd2"]);

    expect(count1).toBe(1);
    expect(count2).toBe(1);
  });

  it("should handle mixed command registration with array form", () => {
    let singleCount = 0;
    let arrayCount1 = 0;
    let arrayCount2 = 0;

    const arrayCommands = [
      {
        name: "array1",
        description: "Array command 1",
        handler: () => {
          arrayCount1++;
        },
      },
      {
        name: "array2",
        description: "Array command 2",
        handler: () => {
          arrayCount2++;
        },
      },
    ];

    const cli = TestBaseCli()
      .command("single", "Single command")
      .on("single", () => {
        singleCount++;
      })
      .command(arrayCommands);

    cli.parse(["single"]);
    cli.parse(["array1"]);
    cli.parse(["array2"]);

    expect(singleCount).toBe(1);
    expect(arrayCount1).toBe(1);
    expect(arrayCount2).toBe(1);
  });

  it("should handle empty command array", () => {
    const cli = TestBaseCli().command([]);

    expect(cli._commands.size).toBe(0);
  });

  it("should throw error when registering duplicate commands in array", () => {
    const commands = [
      {
        name: "duplicate",
        description: "First command",
      },
      {
        name: "duplicate",
        description: "Second command",
      },
    ];

    expect(() => {
      TestBaseCli().command(commands);
    }).toThrowError('Command with name "duplicate" already exists.');
  });
});
