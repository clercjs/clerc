import { TestBaseCli } from "@clerc/test-utils";
import tabtab, { getShellFromEnv } from "@pnpm/tabtab";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { completionsPlugin } from "../src";

vi.mock("@pnpm/tabtab", () => ({
	default: {
		install: vi.fn(),
		uninstall: vi.fn(),
		getCompletionScript: vi.fn().mockResolvedValue("mock script"),
		parseEnv: vi.fn(),
		log: vi.fn(),
		SUPPORTED_SHELLS: ["bash", "zsh", "fish"],
	},
	getShellFromEnv: vi.fn(),
}));

describe("plugin-completions/commands", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("completions install", () => {
		it("should install completions", async () => {
			const cli = TestBaseCli().use(completionsPlugin());

			await cli.parse(["completions", "install", "--shell", "bash"]);

			expect(tabtab.install).toHaveBeenCalledWith({
				name: "test",
				completer: "test",
				shell: "bash",
			});
		});

		it("should throw error if shell is missing", async () => {
			const cli = TestBaseCli().use(completionsPlugin());
			const errorFn = vi.fn();
			cli.errorHandler(errorFn);

			await cli.parse(["completions", "install"]);

			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(errorFn).toHaveBeenCalled();
			expect(errorFn.mock.calls[0][0].message).toContain(
				"Please specify the shell type",
			);
		});

		it("should throw error if shell is unsupported", async () => {
			const cli = TestBaseCli().use(completionsPlugin());
			const errorFn = vi.fn();
			cli.errorHandler(errorFn);

			await cli.parse(["completions", "install", "--shell", "invalid"]);

			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(errorFn).toHaveBeenCalled();
			expect(errorFn.mock.calls[0][0].message).toContain("Unsupported shell");
		});
	});

	describe("completions uninstall", () => {
		it("should uninstall completions", async () => {
			const cli = TestBaseCli().use(completionsPlugin());

			await cli.parse(["completions", "uninstall"]);

			expect(tabtab.uninstall).toHaveBeenCalledWith({
				name: "test",
			});
		});
	});

	describe("completions", () => {
		it("should generate completion script", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			const cli = TestBaseCli().use(completionsPlugin());

			await cli.parse(["completions", "--shell", "bash"]);

			expect(tabtab.getCompletionScript).toHaveBeenCalledWith({
				name: "test",
				completer: "test",
				shell: "bash",
			});
			expect(consoleSpy).toHaveBeenCalledWith("mock script");

			consoleSpy.mockRestore();
		});

		it("should throw error if shell is missing", async () => {
			const cli = TestBaseCli().use(completionsPlugin());
			const errorFn = vi.fn();
			cli.errorHandler(errorFn);

			await cli.parse(["completions"]);

			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(errorFn).toHaveBeenCalled();
			expect(errorFn.mock.calls[0][0].message).toContain(
				"Please specify the shell type",
			);
		});

		it("should throw error if shell is unsupported", async () => {
			const cli = TestBaseCli().use(completionsPlugin());
			const errorFn = vi.fn();
			cli.errorHandler(errorFn);

			await cli.parse(["completions", "--shell", "invalid"]);

			await new Promise((resolve) => setTimeout(resolve, 10));

			expect(errorFn).toHaveBeenCalled();
			expect(errorFn.mock.calls[0][0].message).toContain("Unsupported shell");
		});
	});

	describe("completion-server", () => {
		it("should handle completion request", async () => {
			const cli = TestBaseCli()
				.use(completionsPlugin())
				.command("commit", "Commit changes");

			vi.mocked(tabtab.parseEnv).mockReturnValue({
				complete: true,
				words: ["test", "com"],
				point: 8,
				partial: "test com",
				lastPartial: "com",
				line: "test com",
			} as any);

			vi.mocked(getShellFromEnv).mockReturnValue("bash");

			await cli.parse(["completion-server"]);

			expect(tabtab.log).toHaveBeenCalled();

			const candidates = vi.mocked(tabtab.log).mock.calls[0][0] as any[];

			expect(candidates.some((c) => c.name === "commit")).toBeTruthy();
		});

		it("should do nothing if not in completion mode", async () => {
			const cli = TestBaseCli().use(completionsPlugin());

			vi.mocked(tabtab.parseEnv).mockReturnValue({
				complete: false,
			} as any);

			await cli.parse(["completion-server"]);

			expect(tabtab.log).not.toHaveBeenCalled();
		});
	});
});
