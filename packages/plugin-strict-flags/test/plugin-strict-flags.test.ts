import { TestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { strictFlagsPlugin } from "../src";

describe("plugin-strict-flags", () => {
  it("shouldn't show when flags are not passed", async () => {
    await expect(
      TestBaseCli().use(strictFlagsPlugin()).command("a", "a").parse([]),
    ).rejects.toThrowError("No command specified.");
  });

  it("should show unknown flags", async () => {
    await expect(
      TestBaseCli()
        .use(strictFlagsPlugin())
        .command("a", "a")
        .parse(["a", "-a", "-bc", "--foo"]),
    ).rejects.toThrowError("Unexpected flags: a, b, c and foo");
  });
});
