import { describe, expect, it } from "vitest";
import { Clerc, SingleCommand } from "clerc";

describe("cli", () => {
  it("should parse", () => {
    Clerc.create()
      .command("foo", "foo")
      .on("foo", (ctx) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.raw).toMatchInlineSnapshot(`
          {
            "_": [
              "foo",
            ],
            "flags": {},
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
    Clerc.create()
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
        expect(ctx.name).toEqual(SingleCommand);
        expect(ctx.raw).toMatchInlineSnapshot(`
          {
            "_": [
              "bar",
              "qux",
            ],
            "flags": {
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
  it("should parse parameters", () => {
    Clerc.create()
      .command("foo", "foo", {
        parameters: [
          "[optional ...]",
        ],
      })
      .on("foo", (ctx) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.raw).toMatchInlineSnapshot(`
          {
            "_": [
              "foo",
              "bar",
              "baz",
              "qux",
            ],
            "flags": {},
            "parameters": [
              "bar",
              "baz",
              "qux",
            ],
            "unknownFlags": {
              "c": [
                true,
              ],
            },
          }
        `);
        expect(ctx.parameters).toMatchInlineSnapshot(`
          {
            "optional ": [
              "bar",
              "baz",
              "qux",
            ],
          }
        `);
        expect(ctx.flags).toMatchInlineSnapshot("{}");
      })
      .parse(["foo", "bar", "-c", "baz", "qux"]);
  });
  it("should parse boolean flag", () => {
    Clerc.create()
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
    Clerc.create()
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
        expect(ctx.raw).toMatchInlineSnapshot(`
          {
            "_": [
              "foo",
            ],
            "flags": {
              "foo": "bar",
            },
            "parameters": [],
            "unknownFlags": {},
          }
        `);
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags).toStrictEqual({ foo: "bar" });
      })
      .parse(["foo", "--foo", "bar"]);
  });
  it("should parse number flag", () => {
    Clerc.create()
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
        expect(ctx.raw).toMatchInlineSnapshot(`
          {
            "_": [
              "foo",
            ],
            "flags": {
              "foo": 42,
            },
            "parameters": [],
            "unknownFlags": {},
          }
        `);
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags).toStrictEqual({ foo: 42 });
      })
      .parse(["foo", "--foo", "42"]);
  });
  it("should parse dot-nested flag", () => {
    function Foo (value: string) {
      const [propertyName, propertyValue] = value.split("=");
      return {
        [propertyName]: propertyValue || true,
      };
    }
    Clerc.create()
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
        expect(ctx.raw).toMatchInlineSnapshot(`
          {
            "_": [
              "foo",
            ],
            "flags": {
              "foo": [
                {
                  "a": "42",
                },
                {
                  "b": "bar",
                },
              ],
            },
            "parameters": [],
            "unknownFlags": {},
          }
        `);
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags).toMatchInlineSnapshot(`
          {
            "foo": [
              {
                "a": "42",
              },
              {
                "b": "bar",
              },
            ],
          }
        `);
      })
      .parse(["foo", "--foo.a=42", "--foo.b=bar"]);
  });
  it("should parse shorthand flag", () => {
    Clerc.create()
      .command("foo", "foo", {})
      .on("foo", (ctx) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.raw).toMatchInlineSnapshot(`
          {
            "_": [
              "foo",
              "bar",
            ],
            "flags": {},
            "parameters": [
              "bar",
            ],
            "unknownFlags": {
              "a": [
                true,
              ],
              "b": [
                true,
              ],
              "c": [
                true,
              ],
              "d": [
                true,
              ],
            },
          }
        `);
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags).toMatchInlineSnapshot("{}");
      })
      .parse(["foo", "-abcd", "bar"]);
  });
  it("should parse array flag", () => {
    Clerc.create()
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
        expect(ctx.raw).toMatchInlineSnapshot(`
          {
            "_": [
              "foo",
            ],
            "flags": {
              "abc": [
                "bar",
                "baz",
              ],
            },
            "parameters": [],
            "unknownFlags": {},
          }
        `);
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags).toMatchInlineSnapshot(`
          {
            "abc": [
              "bar",
              "baz",
            ],
          }
        `);
      })
      .parse(["foo", "--abc", "bar", "--abc", "baz"]);
  });
  it("should honor inspector", () => {
    let count = 0;
    Clerc.create()
      .command("foo", "foo")
      .inspector(() => {})
      .on("foo", () => { count++; })
      .parse(["foo"]);
    expect(count).toBe(0);
  });
  it("should next", () => {
    let count = 0;
    Clerc.create()
      .command("foo", "foo")
      .inspector((_ctx, next) => { next(); })
      .inspector((ctx, next) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.raw).toMatchInlineSnapshot(`
          {
            "_": [
              "foo",
            ],
            "flags": {},
            "parameters": [],
            "unknownFlags": {},
          }
        `);
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
      Clerc.create()
        .command("foo", "foo")
        .command("foo", "foo");
    }).toThrowError();
  });
  it("should throw when single command is set", () => {
    expect(() => {
      Clerc.create()
        .command(SingleCommand, "single")
        .command("foo", "foo");
    }).toThrowError();
  });
  it("should throw when common command is set", () => {
    expect(() => {
      Clerc.create()
        .command("foo", "foo")
        .command(SingleCommand, "single");
    }).toThrowError();
  });
});
