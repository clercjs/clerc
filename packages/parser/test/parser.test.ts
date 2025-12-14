import { describe, expect, it } from "vitest";

import {
	InvalidSchemaError,
	KNOWN_FLAG,
	PARAMETER,
	UNKNOWN_FLAG,
	parse,
} from "../src";

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
				"foo",
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
		expect(parameters).toEqual(["foo"]);
	});

	it("should parse aliases and short flags", () => {
		const { flags } = parse(["-f", "-b", "baz", "-n", "123"], {
			flags: {
				foo: { type: Boolean, short: "f" },
				bar: { type: String, short: "b" },
				num: { type: Number, short: "n" },
			},
		});

		expect(flags).toEqual({ foo: true, bar: "baz", num: 123 });
	});

	it("should parse counter flags", () => {
		const { flags } = parse(["--verbose", "--verbose", "-v"], {
			flags: {
				verbose: { type: [Boolean], short: "v" },
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
				aa: { type: Boolean, short: "a" },
				bb: { type: Boolean, short: "b" },
				cc: { type: Boolean, short: "c" },
			},
		});

		expect(result1.flags).toEqual({ aa: true, bb: true, cc: true });

		const result2 = parse(["-ab", "val"], {
			flags: {
				aa: { type: Boolean, short: "a" },
				bb: { type: String, short: "b" },
			},
		});

		expect(result2.flags).toEqual({ aa: true, bb: "val" });

		const result3 = parse(["-abval"], {
			flags: {
				aa: { type: Boolean, short: "a" },
				bb: { type: String, short: "b" },
			},
		});

		expect(result3.flags).toEqual({ aa: true, bb: "val" });
	});

	it("should separate unknown flags and positional arguments", () => {
		const { flags, parameters, doubleDash, unknown, ignored } = parse(
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
		expect(ignored).toEqual([]);
	});

	it("should handle defaults", () => {
		const { flags } = parse(["--str", "val"], {
			flags: {
				str: { type: String, default: "default" },
				bool: { type: Boolean, default: true },
				num: { type: Number, default: 123 },
				arr: { type: [String], default: ["a", "b"] },
				function: { type: String, default: () => "computed" },
			},
		});

		expect(flags).toEqual({
			str: "val",
			bool: true,
			num: 123,
			arr: ["a", "b"],
			function: "computed",
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

	it("should support colon-separated long flags", () => {
		const result1 = parse(["--define:K=V"], {
			flags: {
				define: { type: String },
			},
		});

		expect(result1.flags).toEqual({ define: "K=V" });

		const result2 = parse(["--flag:false", "--flag2:true"], {
			flags: {
				flag: { type: Boolean },
				flag2: { type: Boolean },
			},
		});

		expect(result2.flags).toEqual({ flag: false, flag2: true });

		const result3 = parse(["--config.port:8080"], {
			flags: {
				config: { type: Object },
			},
		});

		expect(result3.flags).toEqual({ config: { port: "8080" } });
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

		expect(() =>
			parse([], {
				flags: {
					" space": { type: String },
				},
			}),
		).toThrow(InvalidSchemaError);

		expect(() =>
			parse([], {
				flags: {
					":colon": { type: String },
				},
			}),
		).toThrow(InvalidSchemaError);

		expect(() =>
			parse([], {
				flags: {
					".dot": { type: String },
				},
			}),
		).toThrow(InvalidSchemaError);

		expect(() =>
			parse([], {
				flags: {
					"=eq": { type: String },
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
				"--string",
				"-a",
				"--not-given",
			],
			{
				flags: {
					num: Number,
					shouldNotBe: Boolean,
					eq: String,
					d1: { type: Boolean, short: "1" },
					alias2: {
						type: Boolean,
						short: "2",
					},
					d3: { type: Boolean, short: "3" },
					d4: { type: Boolean, short: "4" },
					string: String,
					aa: { type: String, short: "a" },
					notGiven: String,
				},
			},
		);

		expect(flags).toEqual({
			num: -1,
			shouldNotBe: true,
			eq: "",
			d1: true,
			alias2: true,
			d3: true,
			d4: true,
			string: "",
			aa: "",
			notGiven: "",
		});
		expect(unknown).toEqual({});
		expect(parameters).toEqual(["-5", "---three"]);
	});

	it("should support ignore callback to stop parsing", () => {
		// Stop parsing after first argument

		let encounteredParameter = false;

		const result1 = parse(["--my-flag", "./file.js", "--my-flag"], {
			flags: {
				myFlag: [Boolean],
			},
			ignore: (type) => {
				if (type === PARAMETER && !encounteredParameter) {
					encounteredParameter = true;

					return false; // Allow first parameter
				}

				// If a parameter has been encountered, stop all subsequent parsing
				return encounteredParameter;
			},
		});

		expect(result1.flags).toEqual({ myFlag: 1 });
		expect(result1.parameters).toEqual([]);
		expect(result1.ignored).toEqual(["--my-flag"]);

		// Stop parsing at a specific flag
		const result2 = parse(
			["--flag1", "value1", "--stop", "--flag2", "value2"],
			{
				flags: {
					flag1: String,
					flag2: String,
				},
				ignore: (type, arg) => arg === "--stop",
			},
		);

		expect(result2.flags).toEqual({ flag1: "value1", flag2: undefined });
		expect(result2.ignored).toEqual(["--stop", "--flag2", "value2"]);

		// Stop parsing after N flags
		let flagCount = 0;
		const result3 = parse(["--aa", "--bb", "--cc", "--dd"], {
			flags: {
				aa: Boolean,
				bb: Boolean,
				cc: Boolean,
				dd: Boolean,
			},
			ignore: (type) => {
				if (type === KNOWN_FLAG) {
					flagCount++;

					return flagCount > 2;
				}

				return false;
			},
		});

		expect(result3.flags).toEqual({ aa: true, bb: true, cc: false, dd: false });
		expect(result3.ignored).toEqual(["--cc", "--dd"]);
	});

	it("should distinguish known and unknown flags in ignore callback", () => {
		const result = parse(["--known", "--unknown", "--known"], {
			flags: {
				known: Boolean,
			},
			ignore: (type) => type === UNKNOWN_FLAG,
		});

		expect(result.flags).toEqual({ known: true });
		expect(result.ignored).toEqual(["--unknown", "--known"]);
	});

	it("should handle custom delimiters", () => {
		const { flags } = parse(["--flag1:val1", "--flag2=val2", "--flag3|val3"], {
			flags: {
				flag1: String,
				flag2: String,
				flag3: String,
			},
			delimiters: [":", "=", "|"],
		});

		expect(flags).toEqual({
			flag1: "val1",
			flag2: "val2",
			flag3: "val3",
		});

		expect(() =>
			parse([], {
				flags: {
					"|invalid": String,
				},
				delimiters: [":", "=", "|"],
			}),
		).toThrow(InvalidSchemaError);
	});

	it('should push to "missingRequiredFlags" on missing required flags', () => {
		const { missingRequiredFlags } = parse([], {
			flags: {
				req1: { type: String, required: true },
				req2: { type: Number, required: true },
				opt: { type: Boolean },
			},
		});

		expect(missingRequiredFlags).toEqual(["req1", "req2"]);
	});

	it("should throw on used required and default on the same flag", () => {
		expect(() => {
			parse([], {
				flags: {
					req: { type: String, required: true, default: "default" },
				},
			});
		}).toThrow(InvalidSchemaError);
	});
});
