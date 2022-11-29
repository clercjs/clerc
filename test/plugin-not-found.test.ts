import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Clerc } from "clerc";
import { notFoundPlugin } from "@clerc/plugin-not-found";

describe("plugin-help", () => {
  const msgs: string[] = [];
  beforeAll(() => {
    // eslint-disable-next-line no-console
    console.log = (s: string) => { msgs.push(s); };
  });
  afterEach(() => {
    msgs.length = 0;
  });
  it("should show commands", () => {
    Clerc.create()
      .name("test")
      .use(notFoundPlugin())
      .parse([""]);
    expect(msgs).toMatchInlineSnapshot(`
      [
        "Command \\"[9m[29m\\" not found.",
        "Did you mean \\"[1mundefined[22m\\"?",
      ]
    `);
    msgs.length = 0;
  });
  it("should show closest command", () => {
    Clerc.create()
      .name("test")
      .use(notFoundPlugin())
      .command("foo", "foo command")
      .parse(["fo"]);
    expect(msgs).toMatchInlineSnapshot(`
      [
        "Command \\"[9mfo[29m\\" not found.",
        "Did you mean \\"[1mfoo[22m\\"?",
      ]
    `);
  });
});
