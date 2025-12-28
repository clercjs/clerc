import { TestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

describe("global flags", () => {
  it("should parse global flag", () => {
    TestBaseCli()
      .globalFlag("foo", "foo", {
        type: String,
        default: "bar",
      })
      .command("bar", "bar")
      .on("bar", (ctx) => {
        expect(ctx.flags.foo).toBe("baaaar");
      })
      .parse(["bar", "--foo", "baaaar"]);
  });

  it("should parse global flag with default value", () => {
    TestBaseCli()
      .globalFlag("foo", "foo", {
        type: String,
        default: "bar",
      })
      .command("bar", "bar")
      .on("bar", (ctx) => {
        expect(ctx.flags.foo).toBe("bar");
      })
      .parse(["bar"]);
  });

  it("should override global flag", () => {
    TestBaseCli()
      .globalFlag("foo", "foo", {
        type: String,
        default: "bar",
      })
      .command("bar", "bar", {
        flags: {
          foo: {
            description: "foo",
            type: String,
            default: "qux",
          },
        },
      })
      .on("bar", (ctx) => {
        expect(ctx.flags.foo).toBe("qux");
      })
      .parse(["bar"]);
  });
});
