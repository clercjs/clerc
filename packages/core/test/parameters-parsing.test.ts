import { TestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

describe("parameters parsing", () => {
  it("should handle root", () => {
    TestBaseCli()
      .command("", "root", {
        flags: {
          foo: {
            description: "",
            type: String,
            default: "",
          },
        },
        parameters: ["[optional...]"],
      })
      .on("", (ctx) => {
        expect(ctx.command.name).toStrictEqual("");
        expect(ctx.rawParsed).toMatchInlineSnapshot(`
          {
            "doubleDash": [],
            "flags": {
              "foo": "baz",
            },
            "ignored": [],
            "missingRequiredFlags": [],
            "parameters": [
              "bar",
              "qux",
            ],
            "raw": [
              "bar",
              "--foo",
              "baz",
              "qux",
            ],
            "unknown": {},
            "unknownRaw": [],
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

    TestBaseCli()
      .command("", "root", {
        flags: {
          foo: {
            description: "",
            type: String,
            default: "",
          },
        },
        parameters: ["<required>"],
      })
      .on("", (ctx) => {
        expect(ctx.command.name).toStrictEqual("");
        expect(ctx.rawParsed).toMatchInlineSnapshot(`
          {
            "doubleDash": [],
            "flags": {
              "foo": "",
            },
            "ignored": [],
            "missingRequiredFlags": [],
            "parameters": [
              "bar",
            ],
            "raw": [
              "bar",
            ],
            "unknown": {},
            "unknownRaw": [],
          }
        `);
        expect(ctx.parameters).toMatchInlineSnapshot(`
					{
					  "required": "bar",
					}
				`);
        expect(ctx.flags).toMatchInlineSnapshot(`
					{
					  "foo": "",
					}
				`);
      })
      .parse(["bar"]);
  });

  it("should parse parameters", () => {
    TestBaseCli()
      .command("foo", "foo", {
        parameters: ["[optional...]"],
      })
      .on("foo", (ctx) => {
        expect(ctx.command.name).toBe("foo");
        expect(ctx.parameters.optional).toStrictEqual(["bar", "baz", "qux"]);
      })
      .parse(["foo", "bar", "-c", "baz", "qux"]);
  });

  it("should parse double dash", () => {
    TestBaseCli()
      .command("foo", "foo", {
        parameters: ["--", "[optional]"],
      })
      .on("foo", (ctx) => {
        expect(ctx.rawParsed).toMatchInlineSnapshot(`
          {
            "doubleDash": [
              "bar",
            ],
            "flags": {},
            "ignored": [],
            "missingRequiredFlags": [],
            "parameters": [],
            "raw": [
              "--",
              "bar",
            ],
            "unknown": {},
            "unknownRaw": [],
          }
        `);
        expect(ctx.parameters.optional).toStrictEqual("bar");
      })
      .parse(["foo", "--", "bar"]);
  });

  it("should handle required double dash", async () => {
    await expect(
      TestBaseCli()
        .command("foo", "foo", {
          parameters: ["--", "<required>"],
        })
        .parse(["foo", "--"]),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      "[Error: Missing required parameter: required]",
    );

    TestBaseCli()
      .command("foo", "foo", {
        parameters: ["--", "<required>"],
      })
      .on("foo", (ctx) => {
        expect(ctx.parameters.required).toBe("bar");
      })
      .parse(["foo", "--", "bar"]);
  });

  it("should parse parameter with space", () => {
    TestBaseCli()
      .command("foo", "foo", {
        parameters: ["<foo bar>"],
      })
      .on("foo", (ctx) => {
        expect(ctx.parameters.fooBar).toBe("baz");
      })
      .parse(["foo", "baz"]);
  });

  it("should resolve parameter with alias correctly", () => {
    TestBaseCli()
      .command("foo", "foo", {
        alias: "bar baz",
        parameters: ["<param>"],
      })
      .on("foo", (ctx) => {
        expect(ctx.parameters.param).toBe("param");
      })
      .parse(["bar", "baz", "param"]);
  });
});
