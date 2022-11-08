/* eslint-disable no-console */
import { beforeAll, describe, expect, it } from "vitest";
import { Clerc } from "clerc";
import { helpPlugin } from "@clerc/plugin-help";

describe("plugin-help", () => {
  const msgs: string[] = [];
  beforeAll(() => {
    console.log = (s: string) => { msgs.push(s); };
  });
  it("should show help", () => {
    Clerc.create()
      .use(helpPlugin())
      .parse(["help"]);
    expect(msgs).toMatchInlineSnapshot(`
      [
        "[33mUSAGE:[39m",
        "     <SUBCOMMAND> [OPTIONS]",
        undefined,
        "[33mCOMMANDS:[39m",
        "    [32mhelp    [39mShow help",
      ]
    `);
    msgs.length = 0;
  });
  it("should show --help", () => {
    Clerc.create()
      .use(helpPlugin())
      .parse(["--help"]);
    expect(msgs).toMatchInlineSnapshot(`
      [
        "[33mUSAGE:[39m",
        "     <SUBCOMMAND> [OPTIONS]",
        undefined,
        "[33mCOMMANDS:[39m",
        "    [32mhelp    [39mShow help",
      ]
    `);
  });
});
