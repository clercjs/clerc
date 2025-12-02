import { describe, expect, it } from "vitest";

import { parse } from "../src";

describe("parser", () => {
	it("should parse basic flags", () => {
		const { flags, _, unknown } = parse(
			["--bool", "--str", "baz", "--num", "123", "--arr", "a", "--arr", "b"],
			{
				flags: {
					bool: { type: Boolean },
					str: { type: String },
					num: { type: Number },
					arr: { type: [String] },
				},
			},
		);

		expect(flags).toEqual({
			bool: true,
			str: "baz",
			num: 123,
			arr: ["a", "b"],
		});
		expect(unknown).toEqual({});
		expect(_).toEqual([]);
	});

	it("should parse aliases and short flags", () => {
		const { flags } = parse(["-f", "-b", "baz", "-n", "123"], {
			flags: {
				foo: { type: Boolean, alias: "f" },
				bar: { type: String, alias: "b" },
				num: { type: Number, alias: "n" },
			},
		});

		expect(flags).toEqual({ foo: true, bar: "baz", num: 123 });
	});

	it("should handle merged short flags", () => {
		// -abc -> a=true, b=true, c=true
		// -ab val -> a=true, b=val
		// -abval -> a=true, b=val
		const result1 = parse(["-abc"], {
			flags: {
				a: { type: Boolean, alias: "a" },
				b: { type: Boolean, alias: "b" },
				c: { type: Boolean, alias: "c" },
			},
		});

		expect(result1.flags).toEqual({ a: true, b: true, c: true });

		const result2 = parse(["-ab", "val"], {
			flags: {
				a: { type: Boolean, alias: "a" },
				b: { type: String, alias: "b" },
			},
		});

		expect(result2.flags).toEqual({ a: true, b: "val" });

		const result3 = parse(["-abval"], {
			flags: {
				a: { type: Boolean, alias: "a" },
				b: { type: String, alias: "b" },
			},
		});

		expect(result3.flags).toEqual({ a: true, b: "val" });
	});

	it("should separate unknown flags and positional arguments", () => {
		const { flags, _, unknown } = parse(
			["--foo", "arg1", "--bar", "baz", "--", "--qux"],
			{
				flags: {
					foo: { type: Boolean },
				},
			},
		);

		expect(flags).toEqual({ foo: true });
		expect(unknown).toEqual({ bar: "baz" });
		expect(_).toEqual(["arg1", "--qux"]);
	});

	it("should handle defaults", () => {
		const { flags } = parse(["--str", "val"], {
			flags: {
				str: { type: String, default: "default" },
				bool: { type: Boolean, default: true },
				num: { type: Number, default: 123 },
				arr: { type: [String], default: ["a", "b"] },
			},
		});

		expect(flags).toEqual({
			str: "val",
			bool: true,
			num: 123,
			arr: ["a", "b"],
		});
	});

	it("should handle camelCase conversion", () => {
		const { flags } = parse(["--my-arg", "val", "--myOtherArg", "val2"], {
			flags: {
				myArg: { type: String },
				myOtherArg: { type: String },
			},
		});

		expect(flags).toEqual({ myArg: "val", myOtherArg: "val2" });
	});

	it("should handle negatable booleans", () => {
		// --no-foo -> foo=false
		// --no-foo=false -> foo=true
		// --noArg -> arg=false
		// negatable: false -> ignored
		const result1 = parse(["--no-foo", "--no-bar=false", "--noBaz"], {
			flags: {
				foo: { type: Boolean },
				bar: { type: Boolean },
				baz: { type: Boolean },
			},
		});

		expect(result1.flags).toEqual({ foo: false, bar: true, baz: false });

		const result2 = parse(["--no-foo"], {
			flags: {
				foo: { type: Boolean, negatable: false },
			},
		});

		expect(result2.flags).toEqual({});
		expect(result2.unknown).toEqual({ noFoo: true });
	});

	it("should handle dot-nested options", () => {
		const { flags } = parse(["--env.SECRET", "bar", "--config.port", "8080"], {
			flags: {
				env: { type: Object },
				config: { type: Object },
			},
		});

		expect(flags).toEqual({
			env: { SECRET: "bar" },
			config: { port: "8080" },
		});
	});
});
