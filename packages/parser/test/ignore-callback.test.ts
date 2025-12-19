import { describe, expect, it } from "vitest";

import { KNOWN_FLAG, PARAMETER, UNKNOWN_FLAG, parse } from "../src";

describe("parser - ignore callback", () => {
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
});
