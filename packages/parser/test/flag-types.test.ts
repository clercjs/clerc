import { describe, expect, it } from "vitest";

import { Enum } from "../src/flag-types";

describe("flag-types", () => {
	describe("Enum", () => {
		it("should create a Enum type function", () => {
			const format = Enum("json", "yaml", "xml");

			expect(typeof format).toBe("function");
			expect(format.display).toBe("json | yaml | xml");
		});

		it("should validate valid enum", () => {
			const format = Enum("json", "yaml", "xml");

			expect(format("json")).toBe("json");
			expect(format("yaml")).toBe("yaml");
			expect(format("xml")).toBe("xml");
		});

		it("should throw an error for invalid enum", () => {
			const format = Enum("json", "yaml", "xml");

			expect(() => format("invalid")).toThrow(
				"Invalid value: invalid. Must be one of: json, yaml, xml",
			);
		});

		it("should handle single choice", () => {
			const format = Enum("only");

			expect(format.display).toBe("only");
			expect(format("only")).toBe("only");
			expect(() => format("other")).toThrow();
		});
	});
});
