import { describe, expectTypeOf, it } from "vitest";

import { Clerc, defineCommand } from "../src";

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

	it("should infer ctx from definition in defineCommand", () => {
		defineCommand(
			{
				name: "foo",
				description: "foo command",
				parameters: ["<bar>", "[baz]", "[qux...]"],
				flags: {
					flag1: { description: "", type: String },
					flag2: { description: "", type: Number, default: 42 },
				},
			},
			(ctx) => {
				expectTypeOf(ctx.parameters).toEqualTypeOf<{
					bar: string;
					baz: string | undefined;
					qux: string[];
				}>();
				expectTypeOf(ctx.flags).toEqualTypeOf<{
					[x: string]: any;
					flag1: string | undefined;
					flag2: number;
				}>();
			},
		);
	});
});
