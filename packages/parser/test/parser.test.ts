import { describe, expect, it } from "vitest";

import { createParser } from "../src";

describe("parser", () => {
  it("should parse basic flags", () => {
    const parser = createParser({
      flags: {
        foo: { type: Boolean },
        bar: { type: String },
      },
    });
    const { flags, unknownFlags, _ } = parser.parse(["--foo", "--bar", "baz"]);

    expect(flags).toEqual({ foo: true, bar: "baz" });
    expect(unknownFlags).toEqual({});
    expect(_).toEqual([]);
  });

  it("should parse aliases", () => {
    const parser = createParser({
      flags: {
        foo: { type: Boolean, alias: "f" },
        bar: { type: String, alias: "b" },
      },
    });
    const { flags, unknownFlags, _ } = parser.parse(["-f", "-b", "baz"]);

    expect(flags).toEqual({ f: true, foo: true, b: "baz", bar: "baz" });
    expect(unknownFlags).toEqual({});
    expect(_).toEqual([]);
  });

  it("should separate unknown flags", () => {
    const parser = createParser({
      flags: {
        foo: { type: Boolean },
      },
    });
    const { flags, unknownFlags, _ } = parser.parse(["--foo", "--bar", "baz"]);

    expect(flags).toEqual({ foo: true });
    expect(unknownFlags).toEqual({ bar: "baz" });
    expect(_).toEqual([]);
  });

  it("should parse positional arguments", () => {
    const parser = createParser({
      flags: {
        foo: { type: Boolean },
      },
    });
    const { flags, unknownFlags, _ } = parser.parse(["--foo", "arg1", "arg2"]);

    expect(flags).toEqual({ foo: true });
    expect(unknownFlags).toEqual({});
    expect(_).toEqual(["arg1", "arg2"]);
  });

  it("should handle number flags as strings", () => {
    const parser = createParser({
      flags: {
        foo: { type: Number },
      },
    });
    const { flags, unknownFlags, _ } = parser.parse(["--foo", "123"]);

    expect(flags).toEqual({ foo: "123" });
    expect(unknownFlags).toEqual({});
    expect(_).toEqual([]);
  });
});