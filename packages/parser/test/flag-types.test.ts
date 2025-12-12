import { describe, expect, it } from "vitest";

import { Choices } from "../src/flag-types";

describe("flag-types", () => {
	describe("Choices", () => {
		it("should create a Choices type function", () => {
			const format = Choices("json", "yaml", "xml");

			expect(typeof format).toBe("function");
			expect(format.display).toBe("json | yaml | xml");
		});

		it("should validate valid choices", () => {
			const format = Choices("json", "yaml", "xml");

			expect(format("json")).toBe("json");
			expect(format("yaml")).toBe("yaml");
			expect(format("xml")).toBe("xml");
		});

		it("should throw an error for invalid choices", () => {
			const format = Choices("json", "yaml", "xml");

			expect(() => format("invalid")).toThrow(
				"Invalid value: invalid. Must be one of: json, yaml, xml",
			);
		});

		it("should handle single choice", () => {
			const format = Choices("only");

			expect(format.display).toBe("only");
			expect(format("only")).toBe("only");
			expect(() => format("other")).toThrow();
		});
	});
});
