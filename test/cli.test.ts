import { Root, defineCommand } from "@clerc/core";
import { describe, expect, it } from "vitest";

import { Cli } from "./create-cli";

describe("cli", () => {
	it("should parse", () => {
		Cli()
			.command("foo", "foo")
			.on("foo", (ctx) => {
				expect(ctx.name).toBe("foo");
				expect(ctx.raw).toMatchInlineSnapshot(`
          {
            "_": [
              "foo",
            ],
            "flags": {},
            "mergedFlags": {},
            "parameters": [],
            "unknownFlags": {},
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
			.command(Root, "root", {
				flags: {
					foo: {
						description: "",
						type: String,
						default: "",
					},
				},
				parameters: ["[optional...]"],
			})
			.on(Root, (ctx) => {
				expect(ctx.name).toStrictEqual(Root);
				expect(ctx.raw).toMatchInlineSnapshot(`
          {
            "_": [
              "bar",
              "qux",
            ],
            "flags": {
              "foo": "baz",
            },
            "mergedFlags": {
              "foo": "baz",
            },
            "parameters": [
              "bar",
              "qux",
            ],
            "unknownFlags": {},
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
	});

	it("should honor root object", () => {
		Cli()
			.command({
				name: Root,
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
					expect(ctx.name).toStrictEqual(Root);
					expect(ctx.raw).toMatchInlineSnapshot(`
            {
              "_": [
                "bar",
                "qux",
              ],
              "flags": {
                "foo": "baz",
              },
              "mergedFlags": {
                "foo": "baz",
              },
              "parameters": [
                "bar",
                "qux",
              ],
              "unknownFlags": {},
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
				expect(ctx.name).toBe("foo");
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
				expect(ctx.name).toBe("foo");
				expect(ctx.raw).toMatchInlineSnapshot(`
          {
            "_": [
              "foo",
            ],
            "flags": {
              "foo": true,
            },
            "mergedFlags": {
              "foo": true,
            },
            "parameters": [],
            "unknownFlags": {},
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
				expect(ctx.name).toBe("foo");
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
				expect(ctx.name).toBe("foo");
				expect(ctx.parameters).toMatchInlineSnapshot("{}");
				expect(ctx.flags).toStrictEqual({ foo: 42 });
			})
			.parse(["foo", "--foo", "42"]);
	});

	it("should parse dot-nested flag", () => {
		function Foo(value: string) {
			const [propertyName, propertyValue] = value.split("=");

			return {
				[propertyName]: propertyValue || true,
			};
		}
		Cli()
			.command("foo", "foo", {
				flags: {
					foo: {
						description: "",
						type: [Foo],
						default: {},
					},
				},
			})
			.on("foo", (ctx) => {
				expect(ctx.name).toBe("foo");
				expect(ctx.parameters).toMatchInlineSnapshot("{}");
				expect(ctx.flags.foo).toStrictEqual([
					{
						a: "42",
					},
					{
						b: "bar",
					},
				]);
			})
			.parse(["foo", "--foo.a=42", "--foo.b=bar"]);
	});

	it("should parse shorthand flag", () => {
		Cli()
			.command("foo", "foo")
			.on("foo", (ctx) => {
				expect(ctx.name).toBe("foo");
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
				expect(ctx.name).toBe("foo");
				expect(ctx.parameters).toMatchInlineSnapshot("{}");
				expect(ctx.flags.abc).toStrictEqual(["bar", "baz"]);
			})
			.parse(["foo", "--abc", "bar", "--abc", "baz"]);
	});

	it("should honor inspector", () => {
		let count = 0;
		Cli()
			.command("foo", "foo")
			.inspector(() => {})
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
			.inspector((_ctx, next) => {
				next();
			})
			.inspector((ctx, next) => {
				expect(ctx.name).toBe("foo");
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
				expect(ctx.name).toBe("foo bar");
				expect(ctx.raw).toMatchInlineSnapshot(`
          {
            "_": [
              "foo",
              "bar",
            ],
            "flags": {},
            "mergedFlags": {},
            "parameters": [],
            "unknownFlags": {},
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
			.parse({ run: false, argv: ["foo"] })
			.runMatchedCommand();

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
			.parse({ run: false, argv: ["foo"] });

		expect(count).toBe(0);
	});

	it("should translate", async () => {
		try {
			Cli("zh-CN").command("foo", "foo").parse(["bar"]);
		} catch (e: any) {
			expect(e.message).toBe('找不到命令: "bar"。');
		}
	});
});
