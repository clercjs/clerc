import { TestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

describe("basic parsing", () => {
  it("should parse", () => {
    TestBaseCli()
      .command("foo", "foo")
      .on("foo", (ctx) => {
        expect(ctx.command.name).toBe("foo");
        expect(ctx.rawParsed).toMatchInlineSnapshot(`
					{
					  "doubleDash": [],
					  "flags": {},
					  "ignored": [],
					  "missingRequiredFlags": [],
					  "parameters": [],
					  "raw": [],
					  "unknown": {},
					}
				`);
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags).toStrictEqual({});
      })
      .parse(["foo"]);
  });

  it("should handle scriptName and name", () => {
    const cli = TestBaseCli().name("test name").scriptName("test");

    expect(cli._name).toBe("test name");
    expect(cli._scriptName).toBe("test");
  });

  it("should handle return scriptName when name is not set", () => {
    const cli = TestBaseCli();

    expect(cli._name).toBe("test");
    expect(cli._scriptName).toBe("test");
  });

  it("should parse shorthand flag", () => {
    TestBaseCli()
      .command("foo", "foo")
      .on("foo", (ctx) => {
        expect(ctx.command.name).toBe("foo");
        expect(ctx.parameters).toMatchInlineSnapshot("{}");
        expect(ctx.flags).toMatchInlineSnapshot("{}");
      })
      .parse(["foo", "-abcd", "bar"]);
  });

  it("should run matched command", () => {
    let count = 0;
    TestBaseCli()
      .command("foo", "foo")
      .on("foo", () => {
        count++;
      })
      .parse({ argv: ["foo"], run: false })
      .run();

    expect(count).toBe(1);
  });

  it("shouldn't run matched command", () => {
    let count = 0;
    TestBaseCli()
      .command("foo", "foo")
      .on("foo", () => {
        count++;
      })
      .parse({ argv: ["foo"], run: false });

    expect(count).toBe(0);
  });
});
