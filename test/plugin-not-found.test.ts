import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { notFoundPlugin } from "@clerc/plugin-not-found";
import { create } from "./create";

describe("plugin-not-found", () => {
  const msgs: string[] = [];
  beforeAll(() => {
    // eslint-disable-next-line no-console
    console.log = (s: string) => { msgs.push(s); };
  });
  afterEach(() => {
    msgs.length = 0;
  });
  it("should show commands", () => {
    create()
      .use(notFoundPlugin())
      .parse([]);

    expect(msgs).toMatchInlineSnapshot(`
      [
        "No command given.",
      ]
    `);
    msgs.length = 0;
  });
  it("should show closest command", () => {
    create()
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
