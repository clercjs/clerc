import { Cli } from "@clerc/test-utils";
import { beforeAll, describe, expect, it } from "vitest";

import { friendlyErrorPlugin } from "../src";

describe("plugin-friendly-error", () => {
	beforeAll(() => {
		process.exit = ((_code?: number) => {}) as any;
	});

	it("should catch error", async () => {
		Cli()
			.use(
				friendlyErrorPlugin({
					target: (s) => {
						expect(s).toMatchInlineSnapshot(`"No such command: "foo"."`);
					},
				}),
			)
			.parse(["foo"]);
	});

	it("should catch async error", () => {
		Cli()
			.use(
				friendlyErrorPlugin({
					target: (s) => expect(s).toMatchInlineSnapshot(`"foo error"`),
				}),
			)
			.command("foo", "foo command")
			.on("foo", async () => {
				throw new Error("foo error");
			})
			.parse(["foo"]);
	});
});
