import { describe, expect, it } from "vitest";

import { InvalidSchemaError, parse } from "../src";

describe("parser", () => {
	it("should parse basic flags", () => {
		const { flags, parameters, unknown } = parse(
			[
				"--bool",
				"--str",
				"baz",
				"--num",
				"123",
				"--arr",
				"a",
				"--arr",
				"b",
				"--unknown=11",
				"-u",
			],
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
		expect(unknown).toEqual({
			u: true,
			unknown: "11",
		});
		expect(parameters).toEqual([]);
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

	it("should parse counter flags", () => {
		const { flags } = parse(["--verbose", "--verbose", "-v"], {
			flags: {
				verbose: { type: [Boolean], alias: "v" },
				foo: [Boolean],
			},
		});

		expect(flags).toEqual({ verbose: 3, foo: 0 });
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
		const { flags, parameters, doubleDash, unknown } = parse(
			["--foo", "arg1", "--bar", "baz", "--", "--qux"],
			{
				flags: {
					foo: { type: Boolean },
				},
			},
		);

		expect(flags).toEqual({ foo: true });
		expect(unknown).toEqual({ bar: "baz" });
		expect(parameters).toEqual(["arg1"]);
		expect(doubleDash).toEqual(["--qux"]);
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

		expect(result2.flags).toEqual({ foo: false });
		expect(result2.unknown).toEqual({ noFoo: true });
	});

	it("should handle boolean props with non-false values", () => {
		const result = parse(["--flag1=1", "--no-flag2=asdf"], {
			flags: {
				flag1: { type: Boolean },
				flag2: { type: Boolean },
			},
		});

		expect(result.flags).toEqual({ flag1: true, flag2: false });
	});

	it("should handle dot-nested options", () => {
		const { flags, unknown } = parse(
			[
				"--env.SECRET",
				"bar",
				"--config.port",
				"8080",
				"--config.enabled",
				"--config.not=false",
				"--config.foo.bar",
				"baz",
				"--unknown.foo",
			],
			{
				flags: {
					env: { type: Object },
					config: { type: Object },
				},
			},
		);

		expect(flags).toEqual({
			env: { SECRET: "bar" },
			config: {
				port: "8080",
				enabled: true,
				not: false,
				foo: { bar: "baz" },
			},
		});
		expect(unknown).toEqual({ "unknown.foo": true });
	});

	it("should initialize arrays, objects and booleans with default values", () => {
		const { flags } = parse([], {
			flags: {
				list: { type: [String] },
				settings: { type: Object },
				flag: { type: Boolean },
			},
		});

		expect(flags).toEqual({
			list: [],
			settings: {},
			flag: false,
		});
	});

	it("should throw on invalid schema", () => {
		expect(() =>
			parse([], {
				flags: {
					// @ts-expect-error Testing invalid schema
					invalid: { type: [String, Number] },
				},
			}),
		).toThrow(InvalidSchemaError);
	});

	it("should handle edge cases", () => {
		const { flags, unknown, parameters } = parse(
			[
				"--num=-1",
				"--should-not-be",
				"-1",
				"-2",
				"-34",
				"-5",
				"--eq=",
				"---three",
			],
			{
				flags: {
					num: Number,
					shouldNotBe: Boolean,
					eq: String,
					1: Boolean,
					alias2: {
						type: Boolean,
						alias: "2",
					},
					3: Boolean,
					4: Boolean,
				},
			},
		);

		expect(flags).toEqual({
			num: -1,
			shouldNotBe: true,
			eq: "",
			1: true,
			alias2: true,
			3: true,
			4: true,
		});
		expect(unknown).toEqual({
			// -three converted to camelCase
			Three: true,
		});
		expect(parameters).toEqual(["-5"]);
	});
});
