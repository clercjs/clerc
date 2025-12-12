import { TestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { Constraints } from "../src";

describe("constraint", () => {
	it("should validate enum", async () => {
		const constraint = Constraints.Enum("a", "b");

		const cli = TestBaseCli().command("test", "test command", {
			parameters: [
				{
					key: "<value>",
					constraint,
				},
			],
		});

		await expect(cli.parse({ argv: ["test", "a"] })).resolves.not.toThrow();
		await expect(cli.parse({ argv: ["test", "b"] })).resolves.not.toThrow();
		await expect(cli.parse({ argv: ["test", "c"] })).rejects.toThrow(
			"Invalid value: c. Must be one of: a, b",
		);
	});

	it("should validate range", async () => {
		const cli = TestBaseCli().command("test", "test command", {
			parameters: [
				{
					key: "<value>",
					constraint: Constraints.Range(1, 10),
				},
			],
		});

		await expect(cli.parse({ argv: ["test", "1"] })).resolves.not.toThrow();
		await expect(cli.parse({ argv: ["test", "10"] })).resolves.not.toThrow();
		await expect(cli.parse({ argv: ["test", "0"] })).rejects.toThrow(
			"Invalid value: 0. Must be a number between 1 and 10",
		);
		await expect(cli.parse({ argv: ["test", "11"] })).rejects.toThrow(
			"Invalid value: 11. Must be a number between 1 and 10",
		);
		await expect(cli.parse({ argv: ["test", "a"] })).rejects.toThrow(
			"Invalid value: a. Must be a number between 1 and 10",
		);
	});

	it("should validate regex", async () => {
		const cli = TestBaseCli().command("test", "test command", {
			parameters: [
				{
					key: "<value>",
					constraint: Constraints.Regex(/^\d+$/),
				},
			],
		});

		await expect(cli.parse({ argv: ["test", "123"] })).resolves.not.toThrow();
		await expect(cli.parse({ argv: ["test", "a"] })).rejects.toThrow(
			"Invalid value: a. Must match pattern: /^\\d+$/",
		);
	});

	it("should validate custom", async () => {
		const cli = TestBaseCli().command("test", "test command", {
			parameters: [
				{
					key: "<value>",
					constraint: Constraints.Custom(
						(value) => value === "foo",
						"foo",
						(value) => `Custom error: ${value}`,
					),
				},
			],
		});

		await expect(cli.parse({ argv: ["test", "foo"] })).resolves.not.toThrow();
		await expect(cli.parse({ argv: ["test", "bar"] })).rejects.toThrow(
			"Custom error: bar",
		);
	});

	it("should validate variadic parameters", async () => {
		const constraint = Constraints.Enum("a", "b");

		const cli = TestBaseCli().command("test", "test command", {
			parameters: [
				{
					key: "<value...>",
					constraint,
				},
			],
		});

		await expect(
			cli.parse({ argv: ["test", "a", "b"] }),
		).resolves.not.toThrow();
		await expect(cli.parse({ argv: ["test", "a", "c"] })).rejects.toThrow(
			"Invalid value: c. Must be one of: a, b",
		);
	});
});
