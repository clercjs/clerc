import { TestBaseCli } from "@clerc/test-utils";
import * as kons from "kons";
import { afterEach, describe, expect, it, vi } from "vitest";

import { friendlyErrorPlugin } from "../src";

vi.mock("kons", () => ({
  error: vi.fn(),
}));

describe("plugin-friendly-error", () => {
  vi.spyOn(process, "exit").mockImplementation(() => ({}) as never);
  const spy = vi.spyOn(kons, "error").mockImplementation(() => {});
  vi.mocked(kons.error).mockImplementation(() => {});

  afterEach(() => {
    spy.mockClear();
  });

  it("should catch error", async () => {
    await TestBaseCli().use(friendlyErrorPlugin()).parse(["foo"]);

    expect(spy.mock.calls).toMatchInlineSnapshot(`
			[
			  [
			    "No such command: "foo".",
			  ],
			]
		`);
  });

  it("should catch async error", async () => {
    await TestBaseCli()
      .use(friendlyErrorPlugin())
      .command("foo", "foo command")
      .on("foo", async () => {
        throw new Error("foo error");
      })
      .parse(["foo"]);

    expect(spy.mock.calls).toMatchInlineSnapshot(`
			[
			  [
			    "foo error",
			  ],
			]
		`);
  });
});
