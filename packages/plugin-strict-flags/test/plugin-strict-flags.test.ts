import { Cli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { strictFlagsPlugin } from "../src";

describe("plugin-strict-flags", () => {
	it("shouldn't show when flags are not passed", () => {
		Cli()
			.errorHandler((err: any) => {
				expect(err).toMatchInlineSnapshot("[Error: No command specified.]");
			})
			.use(strictFlagsPlugin())
			.command("a", "a")
			.parse([]);
	});

	it("should show unknown flags", () => {
		Cli()
			.errorHandler((err: any) => {
				expect(err).toMatchInlineSnapshot(
					"[Error: Unexpected flags: a, b, c and foo]",
				);
			})
			.use(strictFlagsPlugin())
			.command("a", "a")
			.parse(["a", "-a", "-bc", "--foo"]);
	});
});
