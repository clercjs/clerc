import { describe, expect, it } from "vitest";

import { parse } from "../src";

describe("parser", () => {
	it("should parse basic flags", () => {
		const { flags, _, unknown } = parse(["--foo", "--bar", "baz"], {
			flags: {
				foo: { type: Boolean },
				bar: { type: String },
			},
		});

		expect(flags).toEqual({ foo: true, bar: "baz" });
		expect(unknown).toEqual({});
		expect(_).toEqual([]);
	});

	it("should parse aliases", () => {
		const { flags, _, unknown } = parse(["-f", "-b", "baz"], {
			flags: {
				foo: { type: Boolean, alias: "f" },
				bar: { type: String, alias: "b" },
			},
		});

		expect(flags).toEqual({ foo: true, bar: "baz" });
		expect(unknown).toEqual({});
		expect(_).toEqual([]);
	});

	it("should separate unknown flags", () => {
		const { flags, _, unknown } = parse(
			["--foo", "--bar", "baz", "--qux", "--known", "1"],
			{
				flags: {
					foo: { type: Boolean },
					known: { type: Number },
				},
			},
		);

		expect(flags).toEqual({ foo: true, known: 1 });
		expect(unknown).toEqual({ bar: "baz", qux: true });
		expect(_).toEqual([]);
	});

	it("should parse positional arguments", () => {
		const { flags, _, unknown } = parse(["--foo", "arg1", "arg2"], {
			flags: {
				foo: { type: Boolean },
			},
		});

		expect(flags).toEqual({ foo: true });
		expect(unknown).toEqual({});
		expect(_).toEqual(["arg1", "arg2"]);
	});

	it("should handle number flags", () => {
		const { flags, _, unknown } = parse(["--foo", "123"], {
			flags: {
				foo: { type: Number },
			},
		});

		expect(flags).toEqual({ foo: 123 });
		expect(unknown).toEqual({});
		expect(_).toEqual([]);
	});

	it("should handle array flags", () => {
		const { flags } = parse(["--foo", "a", "--foo", "b"], {
			flags: {
				foo: { type: [String] },
			},
		});

		expect(flags).toEqual({ foo: ["a", "b"] });
	});

	it("should handle merged short flags", () => {
		const { flags } = parse(["-abc"], {
			flags: {
				a: { type: Boolean, alias: "a" },
				b: { type: Boolean, alias: "b" },
				c: { type: Boolean, alias: "c" },
			},
		});

		expect(flags).toEqual({ a: true, b: true, c: true });
	});

	it("should handle merged short flags with value", () => {
		const { flags } = parse(["-ab", "val"], {
			flags: {
				a: { type: Boolean, alias: "a" },
				b: { type: String, alias: "b" },
			},
		});

		expect(flags).toEqual({ a: true, b: "val" });
	});

	it("should handle merged short flags with value attached", () => {
		const { flags } = parse(["-abval"], {
			flags: {
				a: { type: Boolean, alias: "a" },
				b: { type: String, alias: "b" },
			},
		});

		expect(flags).toEqual({ a: true, b: "val" });
	});

	it("should handle -- separator", () => {
		const { flags, _ } = parse(["--foo", "--", "--bar", "baz"], {
			flags: {
				foo: { type: Boolean },
				bar: { type: String },
			},
		});

		expect(flags).toEqual({ foo: true });
		expect(_).toEqual(["--bar", "baz"]);
	});

	it("should handle defaults", () => {
		const { flags } = parse([], {
			flags: {
				foo: { type: String, default: "default" },
			},
		});

		expect(flags).toEqual({ foo: "default" });
	});

	it("should handle camelCase conversion", () => {
		const { flags } = parse(["--my-arg", "val"], {
			flags: {
				myArg: { type: String },
			},
		});

		expect(flags).toEqual({ myArg: "val" });
	});

	it("should handle camelCase flags", () => {
		const { flags } = parse(["--myArg", "val"], {
			flags: {
				myArg: { type: String },
			},
		});

		expect(flags).toEqual({ myArg: "val" });
	});

	it("should handle camelCase negated booleans", () => {
		const { flags } = parse(["--noArg"], {
			flags: {
				arg: { type: Boolean },
			},
		});

		expect(flags).toEqual({ arg: false });
	});

	it("should handle negatable booleans", () => {
		const { flags } = parse(["--no-foo"], {
			flags: {
				foo: { type: Boolean },
			},
		});

		expect(flags).toEqual({ foo: false });
	});

	it("should handle negatable booleans with value", () => {
		const { flags } = parse(["--no-foo=false"], {
			flags: {
				foo: { type: Boolean },
			},
		});

		expect(flags).toEqual({ foo: true });
	});

	it("should handle dot-nested options", () => {
		const { flags } = parse(["--env.SECRET", "bar"], {
			flags: {
				env: { type: Object },
			},
		});

		expect(flags).toEqual({ env: { SECRET: "bar" } });
	});
});
