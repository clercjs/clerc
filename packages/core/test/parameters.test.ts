import { TestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { Types } from "../src";

describe("parameter type", () => {
	it("should validate enum", async () => {
		const cli = TestBaseCli().command("test", "test command", {
			parameters: [
				{
					key: "<value>",
					type: Types.Enum("a", "b"),
				},
			],
		});

		await expect(
			cli.parse({ argv: ["test", "a"] }),
		).resolves.not.toThrowError();
		await expect(
			cli.parse({ argv: ["test", "b"] }),
		).resolves.not.toThrowError();
		await expect(cli.parse({ argv: ["test", "c"] })).rejects.toThrowError(
			"Invalid value: c. Must be one of: a, b",
		);
	});

	it("should validate range", async () => {
		const cli = TestBaseCli().command("test", "test command", {
			parameters: [
				{
					key: "<value>",
					type: Types.Range(1, 10),
				},
			],
		});

		await expect(
			cli.parse({ argv: ["test", "1"] }),
		).resolves.not.toThrowError();
		await expect(
			cli.parse({ argv: ["test", "10"] }),
		).resolves.not.toThrowError();
		await expect(cli.parse({ argv: ["test", "0"] })).rejects.toThrowError(
			"Invalid value: 0. Must be a number between 1 and 10",
		);
		await expect(cli.parse({ argv: ["test", "11"] })).rejects.toThrowError(
			"Invalid value: 11. Must be a number between 1 and 10",
		);
		await expect(cli.parse({ argv: ["test", "a"] })).rejects.toThrowError(
			"Invalid value: a. Must be a number between 1 and 10",
		);
	});

	it("should validate regex", async () => {
		const cli = TestBaseCli().command("test", "test command", {
			parameters: [
				{
					key: "<value>",
					type: Types.Regex(/^\d+$/),
				},
			],
		});

		await expect(
			cli.parse({ argv: ["test", "123"] }),
		).resolves.not.toThrowError();
		await expect(cli.parse({ argv: ["test", "a"] })).rejects.toThrowError(
			"Invalid value: a. Must match pattern: /^\\d+$/",
		);
	});

	it("should validate variadic parameters", async () => {
		const cli = TestBaseCli().command("test", "test command", {
			parameters: [
				{
					key: "<value...>",
					type: Types.Enum("a", "b"),
				},
			],
		});

		await expect(
			cli.parse({ argv: ["test", "a", "b"] }),
		).resolves.not.toThrowError();
		await expect(cli.parse({ argv: ["test", "a", "c"] })).rejects.toThrowError(
			"Invalid value: c. Must be one of: a, b",
		);
	});

	it("should convert parameter value using type", async () => {
		await TestBaseCli()
			.command("test", "test command", {
				parameters: [
					{
						key: "<port>",
						type: Types.Range(1024, 65_535),
					},
					{
						key: "[ports...]",
						type: Types.Range(1024, 65_535),
					},
				],
			})
			.on("test", (ctx) => {
				expect(ctx.parameters).toEqual({
					port: 3000,
					ports: [11_451],
				});
			})
			.parse({ argv: ["test", "3000", "11451"] });
	});
});
