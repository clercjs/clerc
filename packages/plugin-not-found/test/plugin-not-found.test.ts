import { friendlyErrorPlugin } from "@clerc/plugin-friendly-error";
import { Cli } from "@clerc/test-utils";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { notFoundPlugin } from "../src";

describe("plugin-not-found", () => {
	beforeAll(() => {
		vi.spyOn(process, "exit").mockImplementation(() => ({}) as never);
	});

	it("should show commands", () => {
		Cli()
			.errorHandler((e) =>
				expect(e).toMatchInlineSnapshot("[Error: No command specified.]"),
			)
			.use(notFoundPlugin())
			.parse([]);
	});

	it("should show closest command", () => {
		Cli()
			.errorHandler((e) =>
				expect(e).toMatchInlineSnapshot(`
					[Error: Command "[9mfo[29m" not found.
					Did you mean "[1mfoo[22m"?]
				`),
			)
			.use(notFoundPlugin())
			.command("foo", "foo command")
			.parse(["fo"]);
	});

	it("should work with friendly-error", () => {
		Cli()
			.use(
				friendlyErrorPlugin({
					target: (str) =>
						expect(str).toMatchInlineSnapshot(`
							"Command "[9mfo[29m" not found.
							Did you mean "[1mfoo[22m"?"
						`),
				}),
			)
			.use(notFoundPlugin())
			.command("foo", "foo command")
			.parse(["fo"]);
	});
});
