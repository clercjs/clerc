import { describe, expect, it } from "vitest";

import { parse } from "../src";

describe("parser - aliases and short flags", () => {
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

	it("should not resolve short flags as long flags", () => {
		// --h should be unknown, not help
		// -h should be help
		const result1 = parse(["--h"], {
			flags: {
				help: { type: Boolean, short: "h" },
			},
		});

		expect(result1.flags).toEqual({ help: false });
		expect(result1.unknown).toEqual({ h: true });

		const result2 = parse(["-h"], {
			flags: {
				help: { type: Boolean, short: "h" },
			},
		});

		expect(result2.flags).toEqual({ help: true });

		const types: string[] = [];
		parse(["--h", "-h"], {
			flags: {
				help: { type: Boolean, short: "h" },
			},
			ignore: (type, arg) => {
				types.push(`${arg}:${type}`);

				return false;
			},
		});

		expect(types).toEqual(["--h:unknown-flag", "-h:known-flag"]);
	});
});