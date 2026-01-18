import { TestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

describe("flags parsing", () => {
  it("should allow flag type shorthand", () => {
    TestBaseCli()
      .command("foo", "foo", {
        flags: {
          str: String,
          num: Number,
          bool: Boolean,
          arr: [String],
        },
      })
      .on("foo", (ctx) => {
        expect(ctx.command.name).toBe("foo");
        expect(ctx.flags).toStrictEqual({
          str: "hello",
          num: 42,
          bool: true,
          arr: ["a", "b", "c"],
        });
      })
      .parse([
        "foo",
        "--str",
        "hello",
        "--num",
        "42",
        "--bool",
        "--arr",
        "a",
        "--arr",
        "b",
        "--arr",
        "c",
      ]);
  });

  it("should parse boolean flag", () => {
    TestBaseCli()
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
        expect(ctx.command.name).toBe("foo");
        expect(ctx.rawParsed).toMatchInlineSnapshot(`
          {
            "doubleDash": [],
            "flags": {
              "foo": true,
            },
            "ignored": [],
            "missingRequiredFlags": [],
            "parameters": [],
            "raw": [
              "--foo",
            ],
            "rawUnknown": [],
            "unknown": {},
          }
        `);
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags).toStrictEqual({ foo: true });
      })
      .parse(["foo", "--foo"]);
  });

  it("should parse string flag", () => {
    TestBaseCli()
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
        expect(ctx.command.name).toBe("foo");
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags).toStrictEqual({ foo: "bar" });
      })
      .parse(["foo", "--foo", "bar"]);
  });

  it("should parse number flag", () => {
    TestBaseCli()
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
        expect(ctx.command.name).toBe("foo");
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags).toStrictEqual({ foo: 42 });
      })
      .parse(["foo", "--foo", "42"]);
  });

  it("should parse dot-nested flag", () => {
    TestBaseCli()
      .command("foo", "foo", {
        flags: {
          foo: {
            description: "",
            type: Object,
            default: {},
          },
        },
      })
      .on("foo", (ctx) => {
        expect(ctx.command.name).toBe("foo");
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags.foo).toStrictEqual({
          a: "42",
          b: "bar",
        });
      })
      .parse(["foo", "--foo.a=42", "--foo.b=bar"]);
  });

  it("should parse array flag", () => {
    TestBaseCli()
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
        expect(ctx.command.name).toBe("foo");
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags.abc).toStrictEqual(["bar", "baz"]);
      })
      .parse(["foo", "--abc", "bar", "--abc", "baz"]);
  });

  it("should register command and global flag without description", () => {
    TestBaseCli()
      .command("foo", {
        flags: {
          bar: {
            type: Boolean,
            default: false,
          },
        },
      })
      .globalFlag("baz", {
        type: Boolean,
        default: false,
      })
      .on("foo", (ctx) => {
        expect(ctx.command.description).toBeUndefined();
        expect(ctx.flags.bar).toBeTruthy();
        expect(ctx.flags.baz).toBeTruthy();
      })
      .parse(["foo", "--bar", "--baz"]);
  });
});
