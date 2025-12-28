import { describe, expect, it } from "vitest";

import { InvalidSchemaError, parse } from "../src";

describe("parser - edge cases", () => {
  it("should throw on invalid schema", () => {
    expect(() =>
      parse([], {
        flags: {
          // @ts-expect-error Testing invalid schema
          invalid: { type: [String, Number] },
        },
      }),
    ).toThrowError(InvalidSchemaError);

    expect(() =>
      parse([], {
        flags: {
          " space": { type: String },
        },
      }),
    ).toThrowError(InvalidSchemaError);

    expect(() =>
      parse([], {
        flags: {
          ":colon": { type: String },
        },
      }),
    ).toThrowError(InvalidSchemaError);

    expect(() =>
      parse([], {
        flags: {
          ".dot": { type: String },
        },
      }),
    ).toThrowError(InvalidSchemaError);

    expect(() =>
      parse([], {
        flags: {
          "=eq": { type: String },
        },
      }),
    ).toThrowError(InvalidSchemaError);
  });

  it("should handle edge cases", () => {
    const { flags, unknown, parameters } = parse(
      [
        "--num=-1",
        "--should-not-be",
        "-1",
        "-2",
        "-34",
        "-5",
        "--eq=",
        "---three",
        "--string",
        "-a",
        "--not-given",
      ],
      {
        flags: {
          num: Number,
          shouldNotBe: Boolean,
          eq: String,
          d1: { type: Boolean, short: "1" },
          alias2: {
            type: Boolean,
            short: "2",
          },
          d3: { type: Boolean, short: "3" },
          d4: { type: Boolean, short: "4" },
          string: String,
          aa: { type: String, short: "a" },
          notGiven: String,
        },
      },
    );

    expect(flags).toEqual({
      num: -1,
      shouldNotBe: true,
      eq: "",
      d1: true,
      alias2: true,
      d3: true,
      d4: true,
      string: "",
      aa: "",
      notGiven: "",
    });
    expect(unknown).toEqual({});
    expect(parameters).toEqual(["-5", "---three"]);
  });
});
