import { describe, expect, it } from "vitest";

import { parse } from "../src";

describe("parser - unknown flags", () => {
  it("should collect unknown flags in unknownRaw", () => {
    const { unknown, unknownRaw } = parse(
      ["--bool", "--unknown=11", "-u", "foo"],
      {
        flags: {
          bool: { type: Boolean },
        },
      },
    );

    expect(unknown).toEqual({
      u: true,
      unknown: "11",
    });
    expect(unknownRaw).toEqual(["--unknown=11", "-u"]);
  });

  it("should collect unknown long flag with separate value", () => {
    const { unknown, unknownRaw } = parse(["--unknown", "value"], {
      flags: {},
    });

    expect(unknown).toEqual({ unknown: "value" });
    expect(unknownRaw).toEqual(["--unknown", "value"]);
  });

  it("should collect unknown long flag without value", () => {
    const { unknown, unknownRaw } = parse(["--unknown"], { flags: {} });

    expect(unknown).toEqual({ unknown: true });
    expect(unknownRaw).toEqual(["--unknown"]);
  });

  it("should collect multiple unknown short flags as single raw arg", () => {
    const { unknown, unknownRaw } = parse(["-abc"], { flags: {} });

    expect(unknown).toEqual({ a: true, b: true, c: true });
    expect(unknownRaw).toEqual(["-abc"]);
  });

  it("should handle mixed known and unknown flags", () => {
    const { flags, unknown, unknownRaw } = parse(
      ["--known", "val", "--unknown1", "--unknown2=value"],
      {
        flags: {
          known: { type: String },
        },
      },
    );

    expect(flags).toEqual({ known: "val" });
    expect(unknown).toEqual({ unknown1: true, unknown2: "value" });
    expect(unknownRaw).toEqual(["--unknown1", "--unknown2=value"]);
  });

  it("should collect raw arg when short flags have mixed known and unknown", () => {
    const { flags, unknown, unknownRaw } = parse(["-ab"], {
      flags: {
        aa: { type: Boolean, short: "a" },
      },
    });

    expect(flags).toEqual({ aa: true });
    expect(unknown).toEqual({ b: true });
    expect(unknownRaw).toEqual(["-ab"]);
  });
});
