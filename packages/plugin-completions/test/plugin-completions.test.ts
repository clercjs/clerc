import { TestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { completionsPlugin } from "../src";

describe("plugin-completions", () => {
  it("should register completions commands by default", () => {
    const cli = TestBaseCli().use(completionsPlugin());

    // Check if commands are registered
    expect(cli._commands.has("complete")).toBeTruthy();
    expect(cli._commands.has("completions")).toBeTruthy();
  });

  it("should have completions command with proper configuration", () => {
    const cli = TestBaseCli().use(completionsPlugin());
    const completionsCmd = cli._commands.get("completions");

    expect(completionsCmd).toBeDefined();
    expect(completionsCmd?.flags).toBeDefined();
    expect(completionsCmd?.flags?.shell).toBeDefined();
  });
});
