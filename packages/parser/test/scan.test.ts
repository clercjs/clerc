import { describe, expect, it } from "vitest";

import { createParser } from "../src";

describe("parser - scan()", () => {
  it("skips known flags (short, bundled, attached, negated, delimited, dot) and yields positionals", () => {
    const parser = createParser({
      flags: {
        verbose: { type: [Boolean], short: "v" },
        color: { type: Boolean },
        config: { type: String, short: "c" },
        env: { type: Object },
      },
    });

    const seen: [string, number][] = [];
    const { stoppedAt } = parser.scan(
      [
        "-vv",
        "--no-color",
        "-capp.json",
        "--env.mode",
        "prod",
        "db",
        "migrate",
        "up",
      ],
      (token, index) => {
        seen.push([token, index]);

        return token !== "migrate";
      },
    );

    expect(seen).toEqual([
      ["db", 5],
      ["migrate", 6],
    ]);
    expect(stoppedAt).toBe(6);
  });

  it("stops on unknown flags and double-dash", () => {
    const parser = createParser({
      flags: { verbose: { type: Boolean, short: "v" } },
    });

    const res1 = parser.scan(["-v", "--unknown", "cmd"], () => true);

    expect(res1.stoppedAt).toBe(1);

    const res2 = parser.scan(["-v", "--", "cmd"], () => true);

    expect(res2.stoppedAt).toBe(1);
  });
});
