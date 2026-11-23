import { describe, expect, it } from "vitest";

import { InvalidSchemaError } from "../src";
import { createLexParser } from "../src/parser";

describe("core lexical parser & scanner", () => {
  it("parses long, short, bundled, =-attached, negated, and counter flags", () => {
    const parser = createLexParser([
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
    const parser = createLexParser([
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
    const wrapper = createLexParser(
      [{ key: "quiet", kind: "boolean", short: "q" }],
      { stopAtFirstPositional: true },
    );

    const wrapRes = wrapper.parse(["-q", "git", "--status", "-s"]);

    expect(wrapRes.flags).toEqual({ quiet: true });
    expect(wrapRes.parameters).toEqual(["git", "--status", "-s"]);

    const scanner = createLexParser([
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
    expect(() => createLexParser([{ key: "a", kind: "boolean" }])).toThrow(
      InvalidSchemaError,
    );
    expect(() =>
      createLexParser([{ key: "bad=name", kind: "single" }]),
    ).toThrow(InvalidSchemaError);
    expect(() =>
      createLexParser([
        { key: "port", kind: "single", short: "p" },
        { key: "path", kind: "single", short: "p" },
      ]),
    ).toThrow(InvalidSchemaError);
  });
});
