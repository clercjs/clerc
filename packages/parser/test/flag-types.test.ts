import { describe, expect, it } from "vitest";

import { Choices } from "../src/flag-types";

describe("flag-types", () => {
	describe("Choices", () => {
		it("should validate choices", () => {
			const format = Choices(["json", "yaml", "xml"]);

			expect(typeof format).toBe("function");
			expect(format.displayName).toBe("json | yaml | xml");
		});
	});
});
