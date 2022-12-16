import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Clerc } from "@clerc/core";
import { strictFlagsPlugin } from "@clerc/plugin-strict-flags";
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
      Clerc.create()
        .name("test")
        .use(strictFlagsPlugin())
        .command("a", "a")
        .parse([]);
    } catch (e: any) {
      expect(e.message).toEqual("No such command: ");
    }
    msgs.length = 0;
  });
  it("should show unknown flags", () => {
    try {
      Clerc.create()
        .name("test")
        .use(strictFlagsPlugin())
        .command("a", "a")
        .parse(["a", "-a", "-bc", "--foo"]);
    } catch (e: any) {
      expect(e.message).toEqual("Unexpected flags: a, b, c and foo");
    }
    msgs.length = 0;
  });
});
