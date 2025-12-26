import { describe, expect, it } from "vitest";

import { InvalidSchemaError, parse } from "../src";

describe("parser - basic flags", () => {
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
					// @ts-expect-error Testing invalid schema
					req: { type: String, required: true, default: "default" },
				},
			});
		}).toThrowError(InvalidSchemaError);
	});
});
