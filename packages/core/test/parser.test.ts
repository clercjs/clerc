import { describe, expect, it } from "vitest";

import { InvalidSchemaError } from "../src";
import { IMPLICIT_FLAG_VALUE, createArgvParser } from "../src/parser";

describe("core argv parser & scanner", () => {
  it("parses long, short, bundled, =-attached, negated, and counter flags", () => {
    const parser = createArgvParser([
      { key: "verbose", kind: "counter", short: "v" },
      { key: "cache", kind: "boolean" },
      { key: "port", kind: "single", short: "p" },
      { key: "tags", kind: "array", short: "t" },
      { key: "all", kind: "boolean", short: "a" },
      { key: "dryRun", kind: "boolean", short: "n" },
    ]);

    const res = parser.parse([
      "--verbose",
      "prod",
      "-vv",
      "--no-cache",
      "-p=8080",
      "-at=v1",
      "-t",
      "v2",
      "--dry-run=1",
      "--",
      "--after",
    ]);

    expect(res.flags).toEqual({
      verbose: 3,
      cache: false,
      port: "8080",
      all: true,
      tags: ["v1", "v2"],
      dryRun: true,
    });
    expect(res.parameters).toEqual(["prod"]);
    expect(res.doubleDash).toEqual(["--after"]);
    expect(res.unknown).toEqual({});
    expect(res.missingValueFlags).toEqual([]);
    expect(res.invalidValues).toEqual([]);
  });

  it("reports missing flag values, invalid booleans, symmetric unknowns, and never eats --", () => {
    const parser = createArgvParser([
      { key: "config", kind: "single", short: "c" },
      { key: "flag", kind: "boolean" },
      { key: "eq", kind: "single" },
    ]);

    const res = parser.parse([
      "--eq=",
      "--flag=banana",
      "--unknown",
      "pos1",
      "--unknown2=val",
      "-u",
      "pos2",
      "-c",
      "--",
      "after-dd",
    ]);

    expect(res.flags).toEqual({ eq: "" });
    expect(res.missingValueFlags).toEqual(["config"]);
    expect(res.invalidValues).toEqual([
      {
        flag: "flag",
        value: "banana",
        message: "expected a boolean ('true' or 'false')",
      },
    ]);
    expect(res.unknown).toEqual({ unknown: true, unknown2: "val", u: true });
    expect(res.parameters).toEqual(["pos1", "pos2"]);
    expect(res.doubleDash).toEqual(["after-dd"]);
  });

  it("supports stopAtFirstPositional and scan() command-tree skipping", () => {
    const wrapper = createArgvParser(
      [{ key: "quiet", kind: "boolean", short: "q" }],
      { stopAtFirstPositional: true },
    );

    const wrapRes = wrapper.parse(["-q", "git", "--status", "-s"]);

    expect(wrapRes.flags).toEqual({ quiet: true });
    expect(wrapRes.parameters).toEqual(["git", "--status", "-s"]);

    const scanner = createArgvParser([
      { key: "verbose", kind: "counter", short: "v" },
      { key: "config", kind: "single", short: "c" },
    ]);
    const seen: [string, number][] = [];
    const { stoppedAt } = scanner.scan(
      ["-vv", "-capp.json", "--config", "a.ts", "db", "migrate", "up"],
      (token, idx) => {
        seen.push([token, idx]);

        return token !== "migrate";
      },
    );

    expect(seen).toEqual([
      ["db", 4],
      ["migrate", 5],
    ]);
    expect(stoppedAt).toBe(5);
    expect(scanner.scan(["-v", "--unknown", "cmd"], () => true).stoppedAt).toBe(
      1,
    );
    expect(scanner.scan(["-v", "--", "cmd"], () => true).stoppedAt).toBe(1);
  });

  it("rejects invalid flag names and duplicate short/alias conflicts", () => {
    expect(() => createArgvParser([{ key: "a", kind: "boolean" }])).toThrow(
      InvalidSchemaError,
    );
    expect(() =>
      createArgvParser([{ key: "bad=name", kind: "single" }]),
    ).toThrow(InvalidSchemaError);
    expect(() =>
      createArgvParser([
        { key: "port", kind: "single", short: "p" },
        { key: "path", kind: "single", short: "p" },
      ]),
    ).toThrow(InvalidSchemaError);
    expect(() =>
      createArgvParser([
        { key: "output", kind: "single", aliases: ["out"] },
        { key: "out", kind: "single" },
      ]),
    ).toThrow(InvalidSchemaError);
    expect(() =>
      createArgvParser([{ key: "output", kind: "single", aliases: ["o"] }]),
    ).toThrow(InvalidSchemaError);
  });

  it("supports flag aliases, optionalValue flags, and missingValueCandidates", () => {
    const parser = createArgvParser([
      {
        key: "output",
        kind: "single",
        short: "o",
        aliases: ["out", "outFile"],
      },
      { key: "color", kind: "boolean", aliases: ["colour"] },
      { key: "inspect", kind: "single", short: "I", optionalValue: true },
      { key: "pattern", kind: "single" },
    ]);

    const res = parser.parse([
      "--out-file",
      "dist.js",
      "--no-colour",
      "--inspect",
      "deploy",
      "--pattern",
      "-bar",
    ]);

    expect(res.flags).toEqual({
      output: "dist.js",
      color: false,
      inspect: IMPLICIT_FLAG_VALUE,
    });
    expect(res.parameters).toEqual(["deploy"]);
    expect(res.missingValueFlags).toEqual(["pattern"]);
    expect(res.missingValueCandidates).toEqual({ pattern: "-bar" });

    // Explicit value via = or short attached overrides implicit value
    expect(parser.parse(["--inspect=9230"]).flags.inspect).toBe("9230");
    expect(parser.parse(["-I=9231"]).flags.inspect).toBe("9231");
    expect(parser.parse(["-I9232"]).flags.inspect).toBe("9232");
    expect(parser.parse(["-I", "deploy"])).toMatchObject({
      flags: { inspect: IMPLICIT_FLAG_VALUE },
      parameters: ["deploy"],
    });

    // scan() recognizes aliases and does not greedily consume next token for optionalValue
    const seen: string[] = [];
    parser.scan(["--out", "a.js", "--inspect", "deploy"], (tok) => {
      seen.push(tok);

      return true;
    });

    expect(seen).toEqual(["deploy"]);
  });
});
