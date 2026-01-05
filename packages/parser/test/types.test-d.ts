import { describe, expectTypeOf, it } from "vitest";

import type { ObjectInputType } from "../src";
import { objectType, parse } from "../src";

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
        objectWithWeirdDefault: { type: Object, default: "not an object" }, // should be ObjectInputType | string
        counterWithWeirdDefault: { type: [Boolean], default: "not a number" }, // should be number | string
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
      objectWithWeirdDefault: ObjectInputType | string;
      counterWithWeirdDefault: number | string;
      any1: any;
      any2: any;
    }>();
  });
});

describe("objectType types", () => {
  it("should infer objectType without generic as ObjectInputType", () => {
    const result = parse([], {
      flags: {
        env: objectType(),
      },
    });
    expectTypeOf(result.flags.env).toEqualTypeOf<ObjectInputType>();
  });

  it("should infer objectType with generic", () => {
    const result = parse([], {
      flags: {
        env: objectType<{ PORT?: number; DEBUG?: boolean }>(),
      },
    });
    expectTypeOf(result.flags.env).toEqualTypeOf<{
      PORT?: number;
      DEBUG?: boolean;
    }>();
  });

  it("should distinguish objectType from Object constructor", () => {
    const result = parse([], {
      flags: {
        withObjectType: objectType(),
        withObjectConstructor: { type: Object },
        withObjectShorthand: Object,
      },
    });

    expectTypeOf(result.flags.withObjectType).toEqualTypeOf<ObjectInputType>();

    // Object constructor uses ObjectInputType
    expectTypeOf(
      result.flags.withObjectConstructor,
    ).toEqualTypeOf<ObjectInputType>();
    expectTypeOf(
      result.flags.withObjectShorthand,
    ).toEqualTypeOf<ObjectInputType>();
  });

  it("should support objectType with custom types in full syntax", () => {
    const result = parse([], {
      flags: {
        config: {
          type: objectType<{
            host?: string;
            port?: number;
            enabled?: boolean;
          }>(),
        },
      },
    });

    expectTypeOf(result.flags.config).toEqualTypeOf<{
      host?: string;
      port?: number;
      enabled?: boolean;
    }>();
  });

  it("should support objectType with default value", () => {
    const result = parse([], {
      flags: {
        config: {
          type: objectType<{ PORT?: number }>(),
          default: { PORT: 3000 },
        },
      },
    });

    expectTypeOf(result.flags.config).toEqualTypeOf<
      NoInfer<{ PORT?: number | undefined }> & { PORT: number }
    >();
  });

  it("should support objectType with required flag", () => {
    const result = parse([], {
      flags: {
        required: {
          type: objectType<{ value?: string }>(),
          required: true,
        },
        optional: {
          type: objectType<{ value?: string }>(),
          required: false,
        },
      },
    });

    expectTypeOf(result.flags.required).toEqualTypeOf<{ value?: string }>();
    expectTypeOf(result.flags.optional).toEqualTypeOf<{ value?: string }>();
  });
});
