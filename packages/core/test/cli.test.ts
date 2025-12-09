import { defineCommand } from "@clerc/core";
import { Cli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

describe("cli", () => {
	it("should parse", () => {
		Cli()
			.command("foo", "foo")
			.on("foo", (ctx) => {
				expect(ctx.command.name).toBe("foo");
				expect(ctx.rawParsed).toMatchInlineSnapshot(`
					{
					  "doubleDash": [],
					  "flags": {},
					  "ignored": [],
					  "parameters": [],
					  "raw": [],
					  "unknown": {},
					}
				`);
				expect(ctx.parameters).toMatchInlineSnapshot("{}");
				expect(ctx.flags).toStrictEqual({});
			})
			.parse(["foo"]);
	});

	it("should honor scriptName and name", () => {
		const cli = Cli().name("test name").scriptName("test");

		expect(cli._name).toBe("test name");
		expect(cli._scriptName).toBe("test");
	});

	it("should honor return scriptName when name is not set", () => {
		const cli = Cli();

		expect(cli._name).toBe("test");
		expect(cli._scriptName).toBe("test");
	});

	it("should honor root", () => {
		Cli()
			.command("", "root", {
				flags: {
					foo: {
						description: "",
						type: String,
						default: "",
					},
				},
				parameters: ["[optional...]"],
			})
			.on("", (ctx) => {
				expect(ctx.command.name).toStrictEqual("");
				expect(ctx.rawParsed).toMatchInlineSnapshot(`
					{
					  "doubleDash": [],
					  "flags": {
					    "foo": "baz",
					  },
					  "ignored": [],
					  "parameters": [
					    "qux",
					  ],
					  "raw": [
					    "--foo",
					    "baz",
					    "qux",
					  ],
					  "unknown": {},
					}
				`);
				expect(ctx.parameters).toMatchInlineSnapshot(`
					{
					  "optional": [
					    "qux",
					  ],
					}
				`);
				expect(ctx.flags).toMatchInlineSnapshot(`
          {
            "foo": "baz",
          }
        `);
			})
			.parse(["bar", "--foo", "baz", "qux"]);
	});

	it("should honor root object", () => {
		Cli()
			.command({
				name: "",
				description: "foo",
				flags: {
					foo: {
						description: "",
						type: String,
						default: "",
					},
				},
				parameters: ["[optional...]"],
				handler: (ctx) => {
					expect(ctx.command.name).toStrictEqual("");
					expect(ctx.rawParsed).toMatchInlineSnapshot(`
						{
						  "doubleDash": [],
						  "flags": {
						    "foo": "baz",
						  },
						  "ignored": [],
						  "parameters": [
						    "qux",
						  ],
						  "raw": [
						    "--foo",
						    "baz",
						    "qux",
						  ],
						  "unknown": {},
						}
					`);
					expect(ctx.parameters).toMatchInlineSnapshot(`
						{
						  "optional": [
						    "qux",
						  ],
						}
					`);
					expect(ctx.flags).toMatchInlineSnapshot(`
            {
              "foo": "baz",
            }
          `);
				},
			})
			.parse(["bar", "--foo", "baz", "qux"]);
	});

	it("should parse parameters", () => {
		Cli()
			.command("foo", "foo", {
				parameters: ["[optional...]"],
			})
			.on("foo", (ctx) => {
				expect(ctx.command.name).toBe("foo");
				expect(ctx.parameters.optional).toStrictEqual(["bar", "baz", "qux"]);
			})
			.parse(["foo", "bar", "-c", "baz", "qux"]);
	});

	it("should parse boolean flag", () => {
		Cli()
			.command("foo", "foo", {
				flags: {
					foo: {
						description: "",
						type: Boolean,
						default: false,
					},
				},
			})
			.on("foo", (ctx) => {
				expect(ctx.command.name).toBe("foo");
				expect(ctx.rawParsed).toMatchInlineSnapshot(`
					{
					  "doubleDash": [],
					  "flags": {
					    "foo": true,
					  },
					  "ignored": [],
					  "parameters": [],
					  "raw": [
					    "--foo",
					  ],
					  "unknown": {},
					}
				`);
				expect(ctx.parameters).toMatchInlineSnapshot("{}");
				expect(ctx.flags).toStrictEqual({ foo: true });
			})
			.parse(["foo", "--foo"]);
	});

	it("should parse string flag", () => {
		Cli()
			.command("foo", "foo", {
				flags: {
					foo: {
						description: "",
						type: String,
						default: "",
					},
				},
			})
			.on("foo", (ctx) => {
				expect(ctx.command.name).toBe("foo");
				expect(ctx.parameters).toMatchInlineSnapshot("{}");
				expect(ctx.flags).toStrictEqual({ foo: "bar" });
			})
			.parse(["foo", "--foo", "bar"]);
	});

	it("should parse number flag", () => {
		Cli()
			.command("foo", "foo", {
				flags: {
					foo: {
						description: "",
						type: Number,
						default: 0,
					},
				},
			})
			.on("foo", (ctx) => {
				expect(ctx.command.name).toBe("foo");
				expect(ctx.parameters).toMatchInlineSnapshot("{}");
				expect(ctx.flags).toStrictEqual({ foo: 42 });
			})
			.parse(["foo", "--foo", "42"]);
	});

	it("should parse dot-nested flag", () => {
		Cli()
			.command("foo", "foo", {
				flags: {
					foo: {
						description: "",
						type: Object,
						default: {},
					},
				},
			})
			.on("foo", (ctx) => {
				expect(ctx.command.name).toBe("foo");
				expect(ctx.parameters).toMatchInlineSnapshot("{}");
				expect(ctx.flags.foo).toStrictEqual({
					a: "42",
					b: "bar",
				});
			})
			.parse(["foo", "--foo.a=42", "--foo.b=bar"]);
	});

	it("should parse shorthand flag", () => {
		Cli()
			.command("foo", "foo")
			.on("foo", (ctx) => {
				expect(ctx.command.name).toBe("foo");
				expect(ctx.parameters).toMatchInlineSnapshot("{}");
				expect(ctx.flags).toMatchInlineSnapshot("{}");
			})
			.parse(["foo", "-abcd", "bar"]);
	});

	it("should parse array flag", () => {
		Cli()
			.command("foo", "foo", {
				flags: {
					abc: {
						description: "",
						type: [String],
						default: [],
					},
				},
			})
			.on("foo", (ctx) => {
				expect(ctx.command.name).toBe("foo");
				expect(ctx.parameters).toMatchInlineSnapshot("{}");
				expect(ctx.flags.abc).toStrictEqual(["bar", "baz"]);
			})
			.parse(["foo", "--abc", "bar", "--abc", "baz"]);
	});

	it("should honor interceptor", () => {
		let count = 0;
		Cli()
			.command("foo", "foo")
			.interceptor(() => {})
			.on("foo", () => {
				count++;
			})
			.parse(["foo"]);

		expect(count).toBe(0);
	});

	it("should next", () => {
		let count = 0;
		Cli()
			.command("foo", "foo")
			.interceptor((_ctx, next) => {
				next();
			})
			.interceptor((ctx, next) => {
				expect(ctx.command?.name).toBe("foo");
				expect(ctx.parameters).toMatchInlineSnapshot("{}");
				expect(ctx.flags).toStrictEqual({});

				next();
			})
			.on("foo", () => {
				count++;
			})
			.parse(["foo"]);

		expect(count).toBe(1);
	});

	it("should have exact one command", () => {
		expect(() => {
			// @ts-expect-error testing
			Cli().command("foo", "foo").command("foo", "foo");
		}).toThrow();
	});

	it("should parse nested command", () => {
		Cli()
			.command("foo bar", "foo bar", {
				flags: {
					aa: {
						type: Boolean,
						description: "aa",
						default: false,
					},
				},
				parameters: ["<param>"],
			})
			.on("foo bar", (ctx) => {
				expect(ctx.flags.aa).toBeTruthy();
				expect(ctx.parameters.param).toBe("param");
			})
			.parse(["foo", "bar", "--aa", "param"]);
	});

	it("shouldn't parse nested command when parent command is called", () => {
		Cli()
			.command("foo bar", "foo bar", {
				flags: {
					aa: {
						type: Boolean,
						description: "aa",
						default: false,
					},
				},
			})
			.command("foo", "foo", {
				flags: {
					bb: {
						type: Boolean,
						description: "bb",
						default: false,
					},
				},
				parameters: ["<param>"],
			})
			.on("foo", (ctx) => {
				expect(ctx.flags.bb).toBeTruthy();
				expect(ctx.parameters.param).toBe("param");
			})
			.parse(["foo", "--bb", "param"]);
	});

	it("shouldn't parse when command is after command", () => {
		Cli()
			.command("foo bar", "foo bar", {
				flags: {
					aa: {
						description: "aa",
						type: Boolean,
						default: false,
					},
				},
			})
			.command("foo", "foo", {
				flags: {
					bb: {
						description: "bb",
						type: Boolean,
						default: false,
					},
				},
				parameters: ["<param>"],
			})
			.on("foo", (ctx) => {
				expect(ctx.flags.bb).toBeTruthy();
				expect(ctx.parameters.param).toBe("bar");
			})
			.parse(["foo", "--bb", "bar"]);
	});

	it("should parse subcommand", () => {
		Cli()
			.command("foo bar", "foo")
			.on("foo bar", (ctx) => {
				expect(ctx.command.name).toBe("foo bar");
				expect(ctx.rawParsed).toMatchInlineSnapshot(`
					{
					  "doubleDash": [],
					  "flags": {},
					  "ignored": [],
					  "parameters": [],
					  "raw": [],
					  "unknown": {},
					}
				`);
				expect(ctx.parameters).toMatchInlineSnapshot("{}");
				expect(ctx.flags).toMatchInlineSnapshot("{}");
			})
			.parse(["foo", "bar"]);
	});

	it("should register command with handler", () => {
		let count = 0;
		const command = defineCommand({
			name: "foo",
			description: "foo",
			handler: () => {
				count++;
			},
		});
		Cli().command(command).parse(["foo"]);

		expect(count).toBe(1);
	});

	it("should run matched command", async () => {
		let count = 0;
		Cli()
			.command("foo", "foo")
			.on("foo", () => {
				count++;
			})
			.parse(["foo"], { run: false })
			.run();

		expect(count).toBe(1);
	});

	it("should resolve parameter with alias correctly", async () => {
		Cli()
			.command("foo", "foo", {
				alias: "bar baz",
				parameters: ["<param>"],
			})
			.on("foo", (ctx) => {
				expect(ctx.parameters.param).toBe("param");
			})
			.parse(["bar", "baz", "param"]);
	});

	it("shouldn't run matched command", async () => {
		let count = 0;
		Cli()
			.command("foo", "foo")
			.on("foo", () => {
				count++;
			})
			.parse(["foo"], { run: false });

		expect(count).toBe(0);
	});
});
