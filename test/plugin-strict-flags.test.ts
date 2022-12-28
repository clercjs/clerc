import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { strictFlagsPlugin } from "@clerc/plugin-strict-flags";
import { create } from "./create";

describe("plugin-strict-flags", () => {
  const msgs: string[] = [];
  beforeAll(() => {
    // eslint-disable-next-line no-console
    console.log = (s: string) => { msgs.push(s); };
  });
  afterEach(() => {
    msgs.length = 0;
  });
  it("shouldn't show when flags are not passed", () => {
    try {
      create()
        .use(strictFlagsPlugin())
        .command("a", "a")
        .parse([]);
    } catch (e: any) {
      expect(e.message).toEqual("No command given.");
    }
    msgs.length = 0;
  });
  it("should show unknown flags", () => {
    try {
      create()
        .use(strictFlagsPlugin())
        .command("a", "a")
        .parse(["a", "-a", "-bc", "--foo"]);
    } catch (e: any) {
      expect(e.message).toEqual("Unexpected flags: a, b, c and foo");
    }
    msgs.length = 0;
  });
});
