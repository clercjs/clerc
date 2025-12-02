import { friendlyErrorPlugin } from "@clerc/plugin-friendly-error";
import { Cli } from "@clerc/test-utils";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

describe("plugin-friendly-error", () => {
	const msgs: string[] = [];

	beforeAll(() => {
		process.exit = ((_code?: number) => {}) as any;
	});

	afterEach(() => {
		msgs.length = 0;
	});

	it("should catch error", () => {
		Cli()
			.use(
				friendlyErrorPlugin({
					target: (s) => msgs.push(s),
				}),
			)
			.parse(["foo"]);

		expect(msgs).toMatchInlineSnapshot(`
			[
			  "No such command: "foo".",
			]
		`);

		msgs.length = 0;
	});

	it("should catch async error", () => {
		Cli()
			.use(
				friendlyErrorPlugin({
					target: (s) => msgs.push(s),
				}),
			)
			.command("foo", "foo command")
			.on("foo", async () => {
				throw new Error("foo error");
			})
			.parse(["foo"]);

		setTimeout(() => {
			expect(msgs).toMatchInlineSnapshot(`
			[
			  "No such command: \\"foo\\".",
			]
		`);
		}, 500);

		msgs.length = 0;
	});
});
