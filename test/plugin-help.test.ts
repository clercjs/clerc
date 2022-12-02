import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Clerc } from "clerc";
import { helpPlugin } from "@clerc/plugin-help";

describe("plugin-help", () => {
  const msgs: string[] = [];
  beforeAll(() => {
    // eslint-disable-next-line no-console
    console.log = (s: string) => { msgs.push(s); };
  });
  afterEach(() => {
    msgs.length = 0;
  });
  it("should show help", () => {
    Clerc.create()
      .name("test")
      .use(helpPlugin())
      .parse(["help"]);
    expect(msgs).toMatchInlineSnapshot(`
      [
        "[32mtest help[39m ",
        "Show help",
        undefined,
        "[33mUSAGE:[39m",
        "    test help [PARAMETERS] [FLAGS]",
        undefined,
        "[33mEXAMPLES:[39m",
        "  test help       Displays help of the cli",
        "  test -h         Displays help of the cli",
        "  test help help  Displays help of the help command",
      ]
    `);
    msgs.length = 0;
  });
  it("should show --help", () => {
    Clerc.create()
      .name("test")
      .use(helpPlugin())
      .parse(["--help"]);
    expect(msgs).toMatchInlineSnapshot(`
      [
        "[32mtest[39m ",
        "[33mUSAGE:[39m",
        "    test <SUBCOMMAND> [OPTIONS]",
        undefined,
        "[33mCOMMANDS:[39m",
        "    [32mhelp    [39mShow help",
      ]
    `);
  });
  it("should show placeholder", () => {
    Clerc.create()
      .use(helpPlugin())
      .parse(["help"]);
    expect(msgs).toMatchInlineSnapshot(`
      [
        "[32m help[39m ",
        "Show help",
        undefined,
        "[33mUSAGE:[39m",
        "     help [PARAMETERS] [FLAGS]",
        undefined,
        "[33mEXAMPLES:[39m",
        "   help       Displays help of the cli",
        "   -h         Displays help of the cli",
        "   help help  Displays help of the help command",
      ]
    `);
  });
  it("should show name, description and version", () => {
    Clerc.create()
      .name("foo")
      .description("foo cli")
      .version("1.0.0")
      .use(helpPlugin())
      .parse(["help"]);
    expect(msgs).toMatchInlineSnapshot(`
      [
        "[32mfoo help[39m v1.0.0",
        "Show help",
        undefined,
        "[33mUSAGE:[39m",
        "    foo help [PARAMETERS] [FLAGS]",
        undefined,
        "[33mEXAMPLES:[39m",
        "  foo help        Displays help of the cli",
        "  foo -h          Displays help of the cli",
        "  foo help help   Displays help of the help command",
      ]
    `);
  });
});
