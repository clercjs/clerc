import { describe, expect, it } from "vitest";

import { createTheme, detectColor } from "../src";

describe("@clerc/theme", () => {
  it("supports default, override, and plain themes", () => {
    const colored = createTheme(true);
    const overridden = createTheme(true, { flag: [] });
    const plain = createTheme(false);

    expect(colored.brand("acme")).toContain("\u001B[");
    expect(colored.flag("--port")).toContain("\u001B[");
    expect(overridden.flag("--port")).toBe("--port");
    expect(plain.brand("acme")).toBe("acme");
  });

  it("delegates color detection to node:tty WriteStream.hasColors", () => {
    expect(detectColor({ NO_COLOR: "1" }, true)).toBeFalsy();
    expect(detectColor({ NODE_DISABLE_COLORS: "1" }, true)).toBeFalsy();
    expect(detectColor({ FORCE_COLOR: "1" }, false)).toBeTruthy();
    expect(detectColor({ FORCE_COLOR: "" }, false)).toBeTruthy();
    expect(detectColor({ FORCE_COLOR: "0" }, true)).toBeFalsy();
    expect(detectColor({ FORCE_COLOR: "false" }, true)).toBeFalsy();
    expect(
      detectColor({ CI: "true", GITHUB_ACTIONS: "true" }, false),
    ).toBeTruthy();
    expect(detectColor({ TERM: "dumb" }, true)).toBeFalsy();
    expect(detectColor({ TERM: "xterm-256color" }, false)).toBeFalsy();
    expect(detectColor({}, true)).toBeTruthy();
    expect(detectColor({}, false)).toBeFalsy();
  });
});
