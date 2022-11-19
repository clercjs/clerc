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
        "[32mtest[39m v",
        "[33mUSAGE:[39m",
        "    test <SUBCOMMAND> [OPTIONS]",
        undefined,
        "[33mCOMMANDS:[39m",
        "    [32mhelp    [39mShow help",
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
        "[32mtest[39m v",
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
        "[33mUSAGE:[39m",
        "    <CLI NAME> <SUBCOMMAND> [OPTIONS]",
        undefined,
        "[33mCOMMANDS:[39m",
        "    [32mhelp    [39mShow help",
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
        "[32mfoo[39m v1.0.0",
        "foo cli",
        undefined,
        "[33mUSAGE:[39m",
        "    foo <SUBCOMMAND> [OPTIONS]",
        undefined,
        "[33mCOMMANDS:[39m",
        "    [32mhelp    [39mShow help",
      ]
    `);
  });
});
