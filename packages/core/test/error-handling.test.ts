import { TestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

describe("error handling", () => {
  it("should throw MissingRequiredFlagError exactly in emit stage", async () => {
    const cli = TestBaseCli().command("test", "test command", {
      flags: {
        requiredFlag: {
          type: String,
          required: true,
        },
      },
    });

    await expect(
      cli.parse({ argv: ["test"] }),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      "[Error: Missing required flag: requiredFlag]",
    );
  });

  it("should not throw MissingRequiredFlagError if not actually calling the handler", async () => {
    let missingRequiredFlags: string[] = [];
    const cli = TestBaseCli()
      .command("test", "test command", {
        flags: {
          requiredFlag: {
            type: String,
            required: true,
          },
        },
      })
      .interceptor((ctx) => {
        missingRequiredFlags = ctx.rawParsed.missingRequiredFlags;
      });

    await expect(cli.parse({ argv: ["test"] })).resolves.not.toThrowError();
    expect(missingRequiredFlags).toEqual(["requiredFlag"]);
  });
});
