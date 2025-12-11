import { TestCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { defineCommand } from "../src";

describe("cli", () => {
	it("should parse", () => {
		TestCli()
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

	it("should handle scriptName and name", () => {
		const cli = TestCli().name("test name").scriptName("test");

		expect(cli._name).toBe("test name");
		expect(cli._scriptName).toBe("test");
	});

	it("should handle return scriptName when name is not set", () => {
		const cli = TestCli();

		expect(cli._name).toBe("test");
		expect(cli._scriptName).toBe("test");
	});

	it("should handle root", () => {
		TestCli()
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
					    "bar",
					    "qux",
					  ],
					  "raw": [
					    "bar",
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
					    "bar",
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

		TestCli()
			.command("", "root", {
				flags: {
					foo: {
						description: "",
						type: String,
						default: "",
					},
				},
				parameters: ["<required>"],
			})
			.on("", (ctx) => {
				expect(ctx.command.name).toStrictEqual("");
				expect(ctx.rawParsed).toMatchInlineSnapshot(`
					{
					  "doubleDash": [],
					  "flags": {
					    "foo": "",
					  },
					  "ignored": [],
					  "parameters": [
					    "bar",
					  ],
					  "raw": [
					    "bar",
					  ],
					  "unknown": {},
					}
				`);
				expect(ctx.parameters).toMatchInlineSnapshot(`
					{
					  "required": "bar",
					}
				`);
				expect(ctx.flags).toMatchInlineSnapshot(`
					{
					  "foo": "",
					}
				`);
			})
			.parse(["bar"]);
	});

	it("should parse parameters", () => {
		TestCli()
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
		TestCli()
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
		TestCli()
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
		TestCli()
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
		TestCli()
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
		TestCli()
			.command("foo", "foo")
			.on("foo", (ctx) => {
				expect(ctx.command.name).toBe("foo");
				expect(ctx.parameters).toMatchInlineSnapshot("{}");
				expect(ctx.flags).toMatchInlineSnapshot("{}");
			})
			.parse(["foo", "-abcd", "bar"]);
	});

	it("should parse array flag", () => {
		TestCli()
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

	it("should handle interceptor", () => {
		let count = 0;
		TestCli()
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
		TestCli()
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
			TestCli().command("foo", "foo").command("foo", "foo");
		}).toThrow();
	});

	it("should parse nested command", () => {
		TestCli()
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
		TestCli()
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
		TestCli()
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
		TestCli()
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
		const command = defineCommand(
			{
				name: "foo",
				description: "foo",
			},
			() => {
				count++;
			},
		);
		TestBaseCli().command(command).parse(["foo"]);

		expect(count).toBe(1);
	});

	it("should run matched command", () => {
		let count = 0;
		TestCli()
			.command("foo", "foo")
			.on("foo", () => {
				count++;
			})
			.parse({ argv: ["foo"], run: false })
			.run();

		expect(count).toBe(1);
	});

	it("should resolve parameter with alias correctly", () => {
		TestCli()
			.command("foo", "foo", {
				alias: "bar baz",
				parameters: ["<param>"],
			})
			.on("foo", (ctx) => {
				expect(ctx.parameters.param).toBe("param");
			})
			.parse(["bar", "baz", "param"]);
	});

	it("shouldn't run matched command", () => {
		let count = 0;
		TestCli()
			.command("foo", "foo")
			.on("foo", () => {
				count++;
			})
			.parse({ argv: ["foo"], run: false });

		expect(count).toBe(0);
	});

	it("should parse global flag", () => {
		TestCli()
			.globalFlag("foo", "foo", {
				type: String,
				default: "bar",
			})
			.command("bar", "bar")
			.on("bar", (ctx) => {
				expect(ctx.flags.foo).toBe("baaaar");
			})
			.parse(["bar", "--foo", "baaaar"]);
	});

	it("should parse global flag with default value", () => {
		TestCli()
			.globalFlag("foo", "foo", {
				type: String,
				default: "bar",
			})
			.command("bar", "bar")
			.on("bar", (ctx) => {
				expect(ctx.flags.foo).toBe("bar");
			})
			.parse(["bar"]);
	});

	it("should override global flag", () => {
		TestCli()
			.globalFlag("foo", "foo", {
				type: String,
				default: "bar",
			})
			.command("bar", "bar", {
				flags: {
					foo: {
						description: "foo",
						type: String,
						default: "qux",
					},
				},
			})
			.on("bar", (ctx) => {
				expect(ctx.flags.foo).toBe("qux");
			})
			.parse(["bar"]);
	});

	it("should parse parameter with space", () => {
		TestCli()
			.command("foo", "foo", {
				parameters: ["<foo bar>"],
			})
			.on("foo", (ctx) => {
				expect(ctx.parameters.fooBar).toBe("baz");
			})
			.parse(["foo", "baz"]);
	});
});
