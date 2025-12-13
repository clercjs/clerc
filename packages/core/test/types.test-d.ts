import { describe, expectTypeOf, it } from "vitest";

import { Clerc, Types, defineCommand } from "../src";

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

	it("should infer flag shorthand", () => {
		Clerc.create()
			.command("bar", "bar", {
				flags: {
					foo: String,
				},
			})
			.on("bar", (ctx) => {
				expectTypeOf(ctx.flags.foo).toEqualTypeOf<string | undefined>();
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

	it("should accept readonly arrays as parameters", () => {
		defineCommand(
			{
				name: "foo",
				description: "foo command",
				parameters: ["<bar>", "[baz]", "[qux...]"] as const,
			},
			(ctx) => {
				expectTypeOf(ctx.parameters).toEqualTypeOf<{
					bar: string;
					baz: string | undefined;
					qux: string[];
				}>();
			},
		);

		const parameters = ["<bar>", "[baz]", "[qux...]"] as const;

		defineCommand(
			{
				name: "foo",
				description: "foo command",
				parameters,
			},
			(ctx) => {
				expectTypeOf(ctx.parameters).toEqualTypeOf<{
					bar: string;
					baz: string | undefined;
					qux: string[];
				}>();
			},
		);

		Clerc.create()
			.command("foo", "foo command", {
				parameters: ["<bar>", "[baz]", "[qux...]"] as const,
			})
			.on("foo", (ctx) => {
				expectTypeOf(ctx.parameters).toEqualTypeOf<{
					bar: string;
					baz: string | undefined;
					qux: string[];
				}>();
			});
	});

	it("should infer parameters types", () => {
		Clerc.create()
			.command("test", "test", {
				parameters: [
					{
						key: "<foo>",
						type: Types.Enum("a", "b"),
					},
					{
						key: "<bar>",
						type: Number,
					},
					{
						key: "[baz]",
						type: Boolean,
					},
					{
						key: "[qux]",
						type: Types.Range(1, 10),
					},
				],
			})
			.on("test", (ctx) => {
				expectTypeOf(ctx.parameters).toEqualTypeOf<{
					foo: "a" | "b";
					bar: number;
					baz: boolean | undefined;
					qux: number | undefined;
				}>();
			});
	});

	it("should infer variadic parameters types", () => {
		Clerc.create()
			.command("test", "test", {
				parameters: [{ key: "<foo...>", type: Types.Enum("a", "b") }],
			})
			.on("test", (ctx) => {
				expectTypeOf(ctx.parameters).toEqualTypeOf<{ foo: ("a" | "b")[] }>();
			});
	});

	it("should infer empty parameters", () => {
		Clerc.create()
			.command("test", "test", {})
			.on("test", (ctx) => {
				expectTypeOf(ctx.parameters).toEqualTypeOf<{}>();
			});
	});
});
