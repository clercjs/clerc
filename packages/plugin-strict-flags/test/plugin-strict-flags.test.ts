import { TestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { strictFlagsPlugin } from "../src";

describe("plugin-strict-flags", () => {
	it("shouldn't show when flags are not passed", async () => {
		await expect(async () => {
			await TestBaseCli().use(strictFlagsPlugin()).command("a", "a").parse([]);
		}).rejects.toThrow("No command specified.");
	});

	it("should show unknown flags", async () => {
		await expect(async () => {
			await TestBaseCli()
				.use(strictFlagsPlugin())
				.command("a", "a")
				.parse(["a", "-a", "-bc", "--foo"]);
		}).rejects.toThrow("Unexpected flags: a, b, c and foo");
	});
});
