import { TestBaseCli } from "@clerc/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { friendlyErrorPlugin } from "../src";

describe("plugin-friendly-error", () => {
  vi.spyOn(process, "exit").mockImplementation(() => ({}) as never);
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    spy.mockClear();
  });

  it("should catch error", async () => {
    await TestBaseCli().use(friendlyErrorPlugin()).parse(["foo"]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain(`No such command: "foo".`);
  });

  it("should catch async error", async () => {
    await TestBaseCli()
      .use(friendlyErrorPlugin())
      .command("foo", "foo command")
      .on("foo", async () => {
        throw new Error("foo error");
      })
      .parse(["foo"]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain("foo error");
  });

  it("should support custom target", async () => {
    const target = vi.fn();
    await TestBaseCli().use(friendlyErrorPlugin({ target })).parse(["foo"]);

    expect(target).toHaveBeenCalledExactlyOnceWith(`No such command: "foo".`);
  });
});
