import { strictFlagsPlugin } from "@clerc/plugin-strict-flags";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { Cli } from "./create-cli";

describe("plugin-strict-flags", () => {
	const msgs: string[] = [];

	beforeAll(() => {
		// eslint-disable-next-line no-console
		console.log = (s: string) => {
			msgs.push(s);
		};
	});

	afterEach(() => {
		msgs.length = 0;
	});

	it("shouldn't show when flags are not passed", () => {
		try {
			Cli().use(strictFlagsPlugin()).command("a", "a").parse([]);
		} catch (error: any) {
			expect(error.message).toBe("No command given.");
		}
		msgs.length = 0;
	});

	it("should show unknown flags", () => {
		try {
			Cli()
				.use(strictFlagsPlugin())
				.command("a", "a")
				.parse(["a", "-a", "-bc", "--foo"]);
		} catch (error: any) {
			expect(error.message).toBe("Unexpected flags: a, b, c and foo.");
		}
		msgs.length = 0;
	});
});
