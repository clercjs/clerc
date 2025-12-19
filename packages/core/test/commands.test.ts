import { TestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { defineCommand } from "../src";

describe("commands", () => {
	it("should have exact one command", () => {
		expect(() => {
			// @ts-expect-error testing
			TestBaseCli().command("foo", "foo").command("foo", "foo");
		}).toThrow();
	});

	it("should parse nested command", () => {
		TestBaseCli()
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
		TestBaseCli()
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
		TestBaseCli()
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
		TestBaseCli()
			.command("foo bar", "foo")
			.on("foo bar", (ctx) => {
				expect(ctx.command.name).toBe("foo bar");
				expect(ctx.rawParsed).toMatchInlineSnapshot(`
					{
					  "doubleDash": [],
					  "flags": {},
					  "ignored": [],
					  "missingRequiredFlags": [],
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

	it("should resolve alias from command object", async () => {
		await expect(
			TestBaseCli()
				.command({
					name: "foo",
					description: "foo",
					alias: "bar",
					handler: (ctx) => {
						expect(ctx.command.name).toBe("foo");
					},
				})
				.parse(["bar"]),
		).resolves.not.toThrow();
	});
});
