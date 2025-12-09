import { describe, expectTypeOf, it } from "vitest";

import { Clerc } from "../src";

describe("core types", () => {
	it("should infer global flags", () => {
		Clerc.create()
			.globalFlag("foo", "foo", {
				type: String,
				default: "bar",
			})
			.command("bar", "bar")
			.on("bar", (ctx) => {
				expectTypeOf(ctx.flags.foo).toEqualTypeOf<string>();
			});
	});

	it("should infer global flags with override", () => {
		Clerc.create()
			.globalFlag("foo", "foo", {
				type: String,
				default: "bar",
			})
			.command("bar", "bar", {
				flags: {
					foo: {
						description: "foo",
						type: Number,
						default: 123,
					},
				},
			})
			.on("bar", (ctx) => {
				expectTypeOf(ctx.flags.foo).toEqualTypeOf<number>();
			});
	});
});
