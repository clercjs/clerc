import { describe, expect, it } from "vitest";
import { SingleCommand } from "@clerc/core";
import { create } from "./create";

describe("cli", () => {
  it("should parse", () => {
    create()
      .command("foo", "foo")
      .on("foo", (ctx) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.raw).toMatchInlineSnapshot(`
          {
            "_": [
              "foo",
            ],
            "flags": {},
            "mergedFlags": {},
            "parameters": [],
            "unknownFlags": {},
          }
        `);
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags).toStrictEqual({});
      })
      .parse(["foo"]);
  });
  it("should honor single command", () => {
    create()
      .command(SingleCommand, "single command", {
        flags: {
          foo: {
            description: "",
            type: String,
            default: "",
          },
        },
        parameters: [
          "[optional...]",
        ],
      })
      .on(SingleCommand, (ctx) => {
        expect(ctx.name).toStrictEqual(SingleCommand);
        expect(ctx.raw).toMatchInlineSnapshot(`
          {
            "_": [
              "bar",
              "qux",
            ],
            "flags": {
              "foo": "baz",
            },
            "mergedFlags": {
              "foo": "baz",
            },
            "parameters": [
              "bar",
              "qux",
            ],
            "unknownFlags": {},
          }
        `);
        expect(ctx.parameters).toMatchInlineSnapshot(`
          {
            "optional": [
              "bar",
              "qux",
            ],
          }
        `);
        expect(ctx.flags).toMatchInlineSnapshot(`
          {
            "foo": "baz",
          }
        `);
      })
      .parse(["bar", "--foo", "baz", "qux"]);
  });
  it("should honor single command object", () => {
    create()
      .command({
        name: SingleCommand,
        description: "foo",
        flags: {
          foo: {
            description: "",
            type: String,
            default: "",
          },
        },
        parameters: [
          "[optional...]",
        ],
        handler: (ctx) => {
          expect(ctx.name).toStrictEqual(SingleCommand);
          expect(ctx.raw).toMatchInlineSnapshot(`
            {
              "_": [
                "bar",
                "qux",
              ],
              "flags": {
                "foo": "baz",
              },
              "mergedFlags": {
                "foo": "baz",
              },
              "parameters": [
                "bar",
                "qux",
              ],
              "unknownFlags": {},
            }
          `);
          expect(ctx.parameters).toMatchInlineSnapshot(`
            {
              "optional": [
                "bar",
                "qux",
              ],
            }
          `);
          expect(ctx.flags).toMatchInlineSnapshot(`
            {
              "foo": "baz",
            }
          `);
        },
      })
      .parse(["bar", "--foo", "baz", "qux"]);
  });
  it("should parse parameters", () => {
    create()
      .command("foo", "foo", {
        parameters: [
          "[optional...]",
        ],
      })
      .on("foo", (ctx) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.parameters.optional).toStrictEqual([
          "bar",
          "baz",
          "qux",
        ]);
      })
      .parse(["foo", "bar", "-c", "baz", "qux"]);
  });
  it("should parse boolean flag", () => {
    create()
      .command("foo", "foo", {
        flags: {
          foo: {
            description: "",
            type: Boolean,
            default: false,
          },
        },
      })
      .on("foo", (ctx) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.raw).toMatchInlineSnapshot(`
          {
            "_": [
              "foo",
            ],
            "flags": {
              "foo": true,
            },
            "mergedFlags": {
              "foo": true,
            },
            "parameters": [],
            "unknownFlags": {},
          }
        `);
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags).toStrictEqual({ foo: true });
      })
      .parse(["foo", "--foo"]);
  });
  it("should parse string flag", () => {
    create()
      .command("foo", "foo", {
        flags: {
          foo: {
            description: "",
            type: String,
            default: "",
          },
        },
      })
      .on("foo", (ctx) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags).toStrictEqual({ foo: "bar" });
      })
      .parse(["foo", "--foo", "bar"]);
  });
  it("should parse number flag", () => {
    create()
      .command("foo", "foo", {
        flags: {
          foo: {
            description: "",
            type: Number,
            default: 0,
          },
        },
      })
      .on("foo", (ctx) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags).toStrictEqual({ foo: 42 });
      })
      .parse(["foo", "--foo", "42"]);
  });
  it("should parse dot-nested flag", () => {
    function Foo(value: string) {
      const [propertyName, propertyValue] = value.split("=");
      return {
        [propertyName]: propertyValue || true,
      };
    }
    create()
      .command("foo", "foo", {
        flags: {
          foo: {
            description: "",
            type: [Foo],
            default: {},
          },
        },
      })
      .on("foo", (ctx) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags.foo).toStrictEqual([
          {
            a: "42",
          },
          {
            b: "bar",
          },
        ]);
      })
      .parse(["foo", "--foo.a=42", "--foo.b=bar"]);
  });
  it("should parse shorthand flag", () => {
    create()
      .command("foo", "foo")
      .on("foo", (ctx) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags).toMatchInlineSnapshot("{}");
      })
      .parse(["foo", "-abcd", "bar"]);
  });
  it("should parse array flag", () => {
    create()
      .command("foo", "foo", {
        flags: {
          abc: {
            description: "",
            type: [String],
            default: [],
          },
        },
      })
      .on("foo", (ctx) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags.abc).toStrictEqual(["bar", "baz"]);
      })
      .parse(["foo", "--abc", "bar", "--abc", "baz"]);
  });
  it("should honor inspector", () => {
    let count = 0;
    create()
      .command("foo", "foo")
      .inspector(() => {})
      .on("foo", () => { count++; })
      .parse(["foo"]);
    expect(count).toBe(0);
  });
  it("should next", () => {
    let count = 0;
    create()
      .command("foo", "foo")
      .inspector((_ctx, next) => { next(); })
      .inspector((ctx, next) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags).toStrictEqual({});
        next();
      })
      .on("foo", () => { count++; })
      .parse(["foo"]);
    expect(count).toBe(1);
  });
  it("should have exact one command", () => {
    expect(() => {
      create()
        .command("foo", "foo")
        .command("foo", "foo");
    }).toThrowError();
  });
  it("should parse nested command", () => {
    create()
      .command("foo bar", "foo bar", {
        flags: {
          aa: {
            type: Boolean,
            default: false,
          },
        },
        parameters: [
          "<param>",
        ],
      })
      .on("foo bar", (ctx) => {
        expect(ctx.flags.aa).toStrictEqual(true);
        expect(ctx.parameters.param).toStrictEqual("param");
      })
      .parse(["foo", "bar", "--aa", "param"]);
  });
  it("shouldn't parse nested command when parent command is called", () => {
    create()
      .command("foo bar", "foo bar", {
        flags: {
          aa: {
            type: Boolean,
            default: false,
          },
        },
      })
      .command("foo", "foo", {
        flags: {
          bb: {
            type: Boolean,
            default: false,
          },
        },
        parameters: [
          "<param>",
        ],
      })
      .on("foo", (ctx) => {
        expect(ctx.flags.bb).toStrictEqual(true);
        expect(ctx.parameters.param).toStrictEqual("param");
      })
      .parse(["foo", "--bb", "param"]);
  });
  it("shouldn't parse when command is after command", () => {
    create()
      .command("foo bar", "foo bar", {
        flags: {
          aa: {
            type: Boolean,
            default: false,
          },
        },
      })
      .command("foo", "foo", {
        flags: {
          bb: {
            type: Boolean,
            default: false,
          },
        },
        parameters: [
          "<param>",
        ],
      })
      .on("foo", (ctx) => {
        expect(ctx.flags.bb).toStrictEqual(true);
        expect(ctx.parameters.param).toStrictEqual("bar");
      })
      .parse(["foo", "--bb", "bar"]);
  });
  it("should parse subcommand", () => {
    create()
      .command("foo bar", "foo")
      .on("foo bar", (ctx) => {
        expect(ctx.name).toBe("foo bar");
        expect(ctx.raw).toMatchInlineSnapshot(`
          {
            "_": [
              "foo",
              "bar",
            ],
            "flags": {},
            "mergedFlags": {},
            "parameters": [],
            "unknownFlags": {},
          }
        `);
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags).toMatchInlineSnapshot("{}");
      })
      .parse(["foo", "bar"]);
  });
  it("should register command with handler", () => {
    let count = 0;
    create()
      .command({
        name: "foo",
        description: "foo",
        handler: () => { count++; },
      })
      .parse(["foo"]);
    expect(count).toBe(1);
  });
});
