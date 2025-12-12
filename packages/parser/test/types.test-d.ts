import { describe, expectTypeOf, it } from "vitest";

import type { ObjectInputType } from "../src";
import { Choices, parse } from "../src";

describe("parser types", () => {
	it("should inferflags", () => {
		const result = parse([], {
			flags: {
				boolean: { type: Boolean },
				string: { type: String },
				number: { type: Number },
				stringWithDefault: { type: String, default: "foo" },
				counter: { type: [Boolean] },
				arrayString: { type: [String] },
				object: { type: Object },
				booleanShorthand: Boolean,
				stringShorthand: String,
				arrayNumberShorthand: [Number],
			},
		});
		expectTypeOf(result.flags).toEqualTypeOf<{
			boolean: boolean;
			string: string | undefined;
			number: number | undefined;
			stringWithDefault: string;
			counter: number;
			arrayString: string[];
			object: ObjectInputType;
			booleanShorthand: boolean;
			stringShorthand: string | undefined;
			arrayNumberShorthand: number[];
		}>();
	});

	it("should infer required", () => {
		const result = parse([], {
			flags: {
				requiredString: { type: String, required: true },
				optionalString: { type: String, required: false },
			},
		});
		expectTypeOf(result.flags).toEqualTypeOf<{
			requiredString: string;
			optionalString: string | undefined;
		}>();
	});

	it("should have negatable only for boolean flags", () => {
		parse([], {
			flags: {
				boolWithNegatable: { type: Boolean, negatable: true },
				boolWithoutNegatable: { type: Boolean },
				// @ts-expect-error negatable is not allowed for non-boolean flags
				stringWithNegatable: { type: String, negatable: true },
				// @ts-expect-error negatable is not allowed for non-boolean flags
				numberWithNegatable: { type: Number, negatable: false },
			},
		});
	});

	it("should infer default values", () => {
		const result = parse([], {
			flags: {
				boolWithDefault: { type: Boolean, default: true },
				stringWithDefault: { type: String, default: "foo" },
				numberWithDefault: { type: Number, default: 42 },
				arrayStringWithDefault: { type: [String], default: ["a", "b"] },
				weirdType: { type: String, default: 123 }, // should be string | number
				any1: Boolean as any,
				any2: { type: Boolean as any },
			},
		});
		expectTypeOf(result.flags).toEqualTypeOf<{
			boolWithDefault: boolean;
			stringWithDefault: string;
			numberWithDefault: number;
			arrayStringWithDefault: string[];
			weirdType: string | number;
			any1: any;
			any2: any;
		}>();
	});

	it("should infer custom choices", () => {
		const result = parse([], {
			flags: {
				choiceFlag: { type: Choices("red", "green", "blue") },
				choiceFlagWithDefault: {
					type: Choices("small", "medium", "large"),
					default: "medium" as const,
				},
			},
		});
		expectTypeOf(result.flags).toEqualTypeOf<{
			choiceFlag: "red" | "green" | "blue" | undefined;
			choiceFlagWithDefault: "small" | "medium" | "large";
		}>();
	});
});
