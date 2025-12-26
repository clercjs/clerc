import { describe, expect, it } from "vitest";

import { InvalidSchemaError, parse } from "../src";

describe("parser - advanced flags", () => {
	it("should parse counter flags", () => {
		const { flags } = parse(["--verbose", "--verbose", "-v"], {
			flags: {
				verbose: { type: [Boolean], short: "v" },
				foo: [Boolean],
			},
		});

		expect(flags).toEqual({ verbose: 3, foo: 0 });
	});

	it("should handle negatable booleans", () => {
		// --no-foo -> foo=false
		// --no-foo=false -> foo=true
		// --noArg -> arg=false
		// negatable: false -> ignored
		const result1 = parse(["--no-foo", "--no-bar=false", "--noBaz"], {
			flags: {
				foo: { type: Boolean },
				bar: { type: Boolean },
				baz: { type: Boolean },
			},
		});

		expect(result1.flags).toEqual({ foo: false, bar: true, baz: false });

		const result2 = parse(["--no-foo"], {
			flags: {
				foo: { type: Boolean, negatable: false },
			},
		});

		expect(result2.flags).toEqual({ foo: false });
		expect(result2.unknown).toEqual({ noFoo: true });
	});

	it("should handle boolean props with non-false values", () => {
		const result = parse(["--flag1=1", "--no-flag2=asdf"], {
			flags: {
				flag1: { type: Boolean },
				flag2: { type: Boolean },
			},
		});

		expect(result.flags).toEqual({ flag1: true, flag2: false });
	});

	it("should handle dot-nested options", () => {
		const { flags, unknown } = parse(
			[
				"--env.SECRET",
				"bar",
				"--config.port",
				"8080",
				"--config.enabled",
				"--config.not=false",
				"--config.foo.bar",
				"baz",
				"--unknown.foo",
			],
			{
				flags: {
					env: { type: Object },
					config: { type: Object },
				},
			},
		);

		expect(flags).toEqual({
			env: { SECRET: "bar" },
			config: {
				port: "8080",
				enabled: true,
				not: false,
				foo: { bar: "baz" },
			},
		});
		expect(unknown).toEqual({ "unknown.foo": true });
	});

	it("should support colon-separated long flags", () => {
		const result1 = parse(["--define:K=V"], {
			flags: {
				define: { type: String },
			},
		});

		expect(result1.flags).toEqual({ define: "K=V" });

		const result2 = parse(["--flag:false", "--flag2:true"], {
			flags: {
				flag: { type: Boolean },
				flag2: { type: Boolean },
			},
		});

		expect(result2.flags).toEqual({ flag: false, flag2: true });

		const result3 = parse(["--config.port:8080"], {
			flags: {
				config: { type: Object },
			},
		});

		expect(result3.flags).toEqual({ config: { port: "8080" } });
	});

	it("should handle custom delimiters", () => {
		const { flags } = parse(["--flag1:val1", "--flag2=val2", "--flag3|val3"], {
			flags: {
				flag1: String,
				flag2: String,
				flag3: String,
			},
			delimiters: [":", "=", "|"],
		});

		expect(flags).toEqual({
			flag1: "val1",
			flag2: "val2",
			flag3: "val3",
		});

		expect(() =>
			parse([], {
				flags: {
					"|invalid": String,
				},
				delimiters: [":", "=", "|"],
			}),
		).toThrowError(InvalidSchemaError);
	});
});
