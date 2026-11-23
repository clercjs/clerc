import { describe, expect, it } from "vitest";

import { createTheme, detectColor, monoThemeStyles } from "../src";

describe("@clerc/theme", () => {
  it("supports default, override, mono, and plain themes", () => {
    const colored = createTheme(true);
    const mono = createTheme(true, monoThemeStyles);
    const plain = createTheme(false);

    expect(colored.brand("acme")).toContain("\u001B[");
    expect(mono.flag("--port")).toBe("--port");
    expect(mono.brand("acme")).toContain("\u001B[");
    expect(plain.brand("acme")).toBe("acme");
  });

  it("respects NO_COLOR, FORCE_COLOR, and TERM=dumb in detectColor", () => {
    expect(detectColor({ NO_COLOR: "1" }, true)).toBeFalsy();
    expect(detectColor({ FORCE_COLOR: "1" }, false)).toBeTruthy();
    expect(detectColor({ FORCE_COLOR: "0" }, true)).toBeFalsy();
    expect(detectColor({ TERM: "dumb" }, true)).toBeFalsy();
    expect(detectColor({}, true)).toBeTruthy();
    expect(detectColor({}, false)).toBeFalsy();
  });
});
