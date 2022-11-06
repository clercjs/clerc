import { describe, expect, it } from "vitest";
import { Clerc } from "clerc";

describe("cli", () => {
  it("should parse", () => {
    Clerc.create()
      .command("foo", "foo")
      .on("foo", (ctx) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.raw).toStrictEqual({ _: ["foo"] });
        expect(ctx.parameters).toStrictEqual([]);
        expect(ctx.flags).toStrictEqual({});
      })
      .parse(["foo"]);
  });
  it("should honor single command", () => {
    Clerc.create()
      .command("", "single command")
      .on("", (ctx) => {
        expect(ctx.name).toBe("");
        expect(ctx.raw).toStrictEqual({ _: ["bar", "qux"], c: "baz" });
        expect(ctx.parameters).toStrictEqual(["bar", "qux"]);
        expect(ctx.flags).toStrictEqual({ c: "baz" });
      })
      .parse(["bar", "-c", "baz", "qux"]);
  });
  it("should parse parameters", () => {
    Clerc.create()
      .command("foo", "foo")
      .on("foo", (ctx) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.raw).toStrictEqual({ _: ["foo", "bar", "qux"], c: "baz" });
        expect(ctx.parameters).toStrictEqual(["bar", "qux"]);
        expect(ctx.flags).toStrictEqual({ c: "baz" });
      })
      .parse(["foo", "bar", "-c", "baz", "qux"]);
  });
  it("should parse boolean flag", () => {
    Clerc.create()
      .command("foo", "foo")
      .on("foo", (ctx) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.raw).toStrictEqual({ _: ["foo"], f: true });
        expect(ctx.parameters).toStrictEqual([]);
        expect(ctx.flags).toStrictEqual({ f: true });
      })
      .parse(["foo", "-f"]);
  });
  it("should parse string flag", () => {
    Clerc.create()
      .command("foo", "foo")
      .on("foo", (ctx) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.raw).toStrictEqual({ _: ["foo"], f: "bar" });
        expect(ctx.parameters).toStrictEqual([]);
        expect(ctx.flags).toStrictEqual({ f: "bar" });
      })
      .parse(["foo", "-f", "bar"]);
  });
  it("should parse number flag", () => {
    Clerc.create()
      .command("foo", "foo")
      .on("foo", (ctx) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.raw).toStrictEqual({ _: ["foo"], f: 42 });
        expect(ctx.parameters).toStrictEqual([]);
        expect(ctx.flags).toStrictEqual({ f: 42 });
      })
      .parse(["foo", "-f", "42"]);
  });
  it("should parse dot-nested flag", () => {
    Clerc.create()
      .command("foo", "foo")
      .on("foo", (ctx) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.raw).toStrictEqual({ _: ["foo"], f: { a: 42, b: "bar" } });
        expect(ctx.parameters).toStrictEqual([]);
        expect(ctx.flags).toStrictEqual({ f: { a: 42, b: "bar" } });
      })
      .parse(["foo", "--f.a", "42", "--f.b", "bar"]);
  });
  it("should parse shorthand flag", () => {
    Clerc.create()
      .command("foo", "foo")
      .on("foo", (ctx) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.raw).toStrictEqual({ _: ["foo"], a: true, b: true, c: true, d: "bar" });
        expect(ctx.parameters).toStrictEqual([]);
        expect(ctx.flags).toStrictEqual({ a: true, b: true, c: true, d: "bar" });
      })
      .parse(["foo", "-abcd", "bar"]);
  });
  it("should parse array flag", () => {
    Clerc.create()
      .command("foo", "foo")
      .on("foo", (ctx) => {
        expect(ctx.name).toBe("foo");
        expect(ctx.raw).toStrictEqual({ _: ["foo"], a: ["bar", "baz"] });
        expect(ctx.parameters).toStrictEqual([]);
        expect(ctx.flags).toStrictEqual({ a: ["bar", "baz"] });
      })
      .parse(["foo", "-a", "bar", "-a", "baz"]);
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
        expect(ctx.raw).toStrictEqual({ _: ["foo"] });
        expect(ctx.parameters).toStrictEqual([]);
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
        .command("", "single")
        .command("foo", "foo");
    }).toThrowError();
  });
  it("should throw when common command is set", () => {
    expect(() => {
      Clerc.create()
        .command("foo", "foo")
        .command("", "single");
    }).toThrowError();
  });
});
