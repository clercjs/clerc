import { describe, expectTypeOf, it } from "vitest";

import { Clerc } from "../src";

describe("core types", () => {
	it("should infer required parameter", () => {
		Clerc.create()
			.command("foo", "foo command", {
				parameters: ["<bar>"],
			})
			.on("foo", (ctx) => {
				expectTypeOf(ctx.parameters.bar).toEqualTypeOf<string>();
			});
	});

	it("should infer optional parameter", () => {
		Clerc.create()
			.command("foo", "foo command", {
				parameters: ["[bar...]"],
			})
			.on("foo", (ctx) => {
				expectTypeOf(ctx.parameters.bar).toEqualTypeOf<string[]>();
			});
	});

	it("should infer variadic parameter", () => {
		Clerc.create()
			.command("foo", "foo command", {
				parameters: ["[bar...]"],
			})
			.on("foo", (ctx) => {
				expectTypeOf(ctx.parameters.bar).toEqualTypeOf<string[]>();
			});
	});

	it("should infer multiple parameters", () => {
		Clerc.create()
			.command("foo", "foo command", {
				parameters: ["<bar>", "[baz]", "[qux...]"],
			})
			.on("foo", (ctx) => {
				expectTypeOf(ctx.parameters).toEqualTypeOf<{
					bar: string;
					baz: string | undefined;
					qux: string[];
				}>();
			});
	});

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

	it("should infer parameter with space", () => {
		Clerc.create()
			.command("foo", "foo command", {
				parameters: ["<foo bar>"],
			})
			.on("foo", (ctx) => {
				expectTypeOf(ctx.parameters.fooBar).toEqualTypeOf<string>();
			});
	});
});
