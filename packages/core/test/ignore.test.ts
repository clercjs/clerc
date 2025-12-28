import { PARAMETER } from "@clerc/parser";
import { describe, expect, it } from "vitest";

import { createStopAtFirstParameter as _createStopAtFirstParameter } from "../src/ignore";

function createStopAtFirstParameter() {
  const fn = _createStopAtFirstParameter();

  return (type: "known-flag" | "unknown-flag" | "parameter") => fn(type, "");
}

describe("ignore", () => {
  describe("createStopAtFirstParameter", () => {
    it("should return an ignore function", () => {
      const ignoreFn = _createStopAtFirstParameter();

      expect(typeof ignoreFn).toBe("function");
    });

    it("should allow the first parameter and ignore subsequent ones", () => {
      const ignoreFn = createStopAtFirstParameter();

      // First parameter should be allowed (returns false = don't ignore)
      expect(ignoreFn(PARAMETER)).toBeFalsy();

      // Subsequent parameters should be ignored (returns true = ignore)
      expect(ignoreFn(PARAMETER)).toBeTruthy();
      expect(ignoreFn(PARAMETER)).toBeTruthy();
    });

    it("should ignore flags", () => {
      const ignoreFn = createStopAtFirstParameter();

      // Flags should be ignored from the start
      expect(ignoreFn("unknown-flag")).toBeFalsy();
      expect(ignoreFn("known-flag")).toBeFalsy();
    });

    it("should stop ignoring after first parameter encountered", () => {
      const ignoreFn = createStopAtFirstParameter();

      // First parameter
      const result1 = ignoreFn(PARAMETER);

      expect(result1).toBeFalsy();

      // Other types after first parameter
      expect(ignoreFn("unknown-flag")).toBeTruthy();
      expect(ignoreFn("known-flag")).toBeTruthy();
    });
  });
});
