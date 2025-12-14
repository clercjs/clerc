import t from "@bomb.sh/tab";
import { TestBaseCli } from "@clerc/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { completionsPlugin } from "../src";

vi.mock("@bomb.sh/tab", () => ({
	default: {
		setup: vi.fn(),
		parse: vi.fn(),
		commands: new Map(),
		options: new Map(),
		arguments: new Map(),
		completions: [],
		command: vi.fn().mockReturnValue({
			option: vi.fn(),
		}),
		option: vi.fn(),
	},
}));

describe("plugin-completions/commands", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("completions", () => {
		it("should setup completions with shell parameter", async () => {
			const cli = TestBaseCli().use(completionsPlugin());

			await cli.parse(["completions", "bash"]);

			expect(t.setup).toHaveBeenCalledWith("test", "test", "bash");
		});

		it("should setup completions with shell flag", async () => {
			const cli = TestBaseCli().use(completionsPlugin());

			await cli.parse(["completions", "--shell", "zsh"]);

			expect(t.setup).toHaveBeenCalledWith("test", "test", "zsh");
		});

		it("should throw error if shell is missing", async () => {
			await expect(async () => {
				await TestBaseCli().use(completionsPlugin()).parse(["completions"]);
			}).rejects.toThrow(
				"Shell type is required. Please provide it via --shell flag or [shell] parameter.",
			);
		});

		it("should throw error if shell is unsupported", async () => {
			await expect(async () => {
				await TestBaseCli()
					.use(completionsPlugin())
					.parse(["completions", "--shell", "invalid"]);
			}).rejects.toThrowErrorMatchingInlineSnapshot(
				"[Error: Invalid value: invalid. Must be one of: zsh, bash, fish, powershell]",
			);
		});
	});

	describe("complete", () => {
		it("should parse completion input", async () => {
			const cli = TestBaseCli()
				.use(completionsPlugin())
				.command("commit", "Commit changes");

			await cli.parse(["complete", "--", "test", "com"]);

			expect(t.parse).toHaveBeenCalledWith(["test", "com"]);
		});

		it("should handle empty input", async () => {
			const cli = TestBaseCli().use(completionsPlugin());

			await cli.parse(["complete", "--"]);

			expect(t.parse).toHaveBeenCalledWith([]);
		});
	});
});
