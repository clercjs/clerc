import { describe, expectTypeOf, it } from "vitest";

import { parse } from "../src";

describe("parser types", () => {
	it("should inferflags", () => {
		const result = parse([], {
			flags: {
				boolean: { type: Boolean },
				string: { type: String },
				number: { type: Number },
				stringWithDefault: { type: String, default: "foo" },
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
			string: string | undefined;
			number: number | undefined;
			stringWithDefault: string;
			never: never;
			arrayString: string[];
			object: Record<string, string | boolean>;
			booleanShorthand: boolean;
			stringShorthand: string | undefined;
			arrayNumberShorthand: number[];
		}>();
	});
});
