import { TestCli } from "@clerc/test-utils";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { notFoundPlugin } from "../src";

describe("plugin-not-found", () => {
	beforeAll(() => {
		vi.spyOn(process, "exit").mockImplementation(() => ({}) as never);
	});

	it("should show commands", async () => {
		await expect(async () => {
			await TestCli().use(notFoundPlugin()).parse([]);
		}).rejects.toThrowErrorMatchingInlineSnapshot(
			"[Error: No command specified.]",
		);
	});

	it("should show closest command", async () => {
		await expect(async () => {
			await TestCli()
				.use(notFoundPlugin())
				.command("foo", "foo command")
				.parse(["fo"]);
		}).rejects.toThrowErrorMatchingInlineSnapshot(`
			[Error: Command "[9mfo[29m" not found.
			Did you mean "[1mfoo[22m"?]
		`);
	});
});
