import { describe, expect, it } from "vitest";

import { Enum, Range, Regex } from "../src";
import { FlagValidationError } from "../src/errors";

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
			expect(() => format("invalid")).toThrow(FlagValidationError);
		});

		it("should handle single choice", () => {
			const format = Enum("only");

			expect(format.display).toBe("only");
			expect(format("only")).toBe("only");
			expect(() => format("other")).toThrow();
		});
	});

	describe("Range", () => {
		it("should create a Range type function", () => {
			const range = Range(1, 10);

			expect(typeof range).toBe("function");
			expect(range.display).toBe("1 - 10");
		});

		it("should validate valid range", () => {
			const range = Range(1, 10);

			expect(range("1")).toBe(1);
			expect(range("5")).toBe(5);
			expect(range("10")).toBe(10);
		});

		it("should throw an error for invalid range", () => {
			const range = Range(1, 10);

			expect(() => range("0")).toThrow(
				"Invalid value: 0. Must be a number between 1 and 10",
			);
			expect(() => range("11")).toThrow(
				"Invalid value: 11. Must be a number between 1 and 10",
			);
			expect(() => range("a")).toThrow(
				"Invalid value: a. Must be a number between 1 and 10",
			);
			expect(() => range("a")).toThrow(FlagValidationError);
		});
	});

	describe("Regex", () => {
		it("should create a Regex type function", () => {
			const regex = Regex(/^\d+$/);

			expect(typeof regex).toBe("function");
			expect(regex.display).toBe("Regex: /^\\d+$/");
		});

		it("should validate valid regex", () => {
			const regex = Regex(/^\d+$/);

			expect(regex("123")).toBe("123");
		});

		it("should throw an error for invalid regex", () => {
			const regex = Regex(/^\d+$/);

			expect(() => regex("a")).toThrow(
				"Invalid value: a. Must match pattern: /^\\d+$/",
			);
			expect(() => regex("a")).toThrow(FlagValidationError);
		});
	});
});
