import { TestBaseCli } from "@clerc/test-utils";
import { describe, expect, it, vi } from "vitest";

import { notFoundPlugin } from "../src";

describe("plugin-not-found", () => {
	vi.spyOn(process, "exit").mockImplementation(() => ({}) as never);

	it("should show commands", async () => {
		await expect(
			TestBaseCli().use(notFoundPlugin()).parse([]),
		).rejects.toThrowErrorMatchingInlineSnapshot(
			"[Error: No command specified.]",
		);
	});

	it("should show closest command", async () => {
		await expect(
			TestBaseCli()
				.use(notFoundPlugin())
				.command("foo", "foo command")
				.parse(["fo"]),
		).rejects.toThrowErrorMatchingInlineSnapshot(`
			[Error: Command "[9mfo[29m" not found.
			Did you mean "[1mfoo[22m"?]
		`);
	});

	it("should not show closest command when distance is above threshold", async () => {
		await expect(
			TestBaseCli()
				.use(notFoundPlugin())
				.command("fooasdf", "foo command")
				.parse(["f"]),
		).rejects.toThrowErrorMatchingInlineSnapshot(
			`[Error: Command "[9mf[29m" not found.]`,
		);
	});

	it("should read custom threshold", async () => {
		await expect(
			TestBaseCli()
				.use(notFoundPlugin({ distanceThreshold: 1 }))
				.command("fooasdf", "foo command")
				.parse(["fooas"]),
		).rejects.toThrowErrorMatchingInlineSnapshot(
			`[Error: Command "[9mfooas[29m" not found.]`,
		);
	});
});
