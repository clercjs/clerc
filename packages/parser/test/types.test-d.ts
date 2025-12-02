import { describe, expectTypeOf, it } from "vitest";

import { parse } from "../src";

describe("parser types", () => {
	it("should inferflags", () => {
		const result = parse([], {
			flags: {
				boolean: { type: Boolean },
				string: { type: String },
				number: { type: Number },
				never: { type: [Boolean] },
				arrayString: { type: [String] },
				object: { type: Object },
				booleanShorthand: Boolean,
				stringShorthand: String,
				arrayNumberShorthand: [Number],
			},
		});
		expectTypeOf(result.flags).toEqualTypeOf<{
			boolean: boolean;
			string: string;
			number: number;
			never: never;
			arrayString: string[];
			object: Record<string, string | boolean>;
			booleanShorthand: boolean;
			stringShorthand: string;
			arrayNumberShorthand: number[];
		}>();
	});
});
