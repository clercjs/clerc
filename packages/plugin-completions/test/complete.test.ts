import { TestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { getCompletion } from "../src/complete";

describe("plugin-completions/complete", () => {
	describe("getCompletion", () => {
		it("should return empty array when -- is present", async () => {
			const cli = TestBaseCli();
			const env = {
				partial: "test --",
				lastPartial: "",
				complete: true,
				words: ["test", "--"],
				point: 8,
			};
			// TODO: remove type assertion after fixing types
			const result = await getCompletion(cli, env as any);

			expect(Array.isArray(result)).toBeTruthy();
			expect(result).toHaveLength(0);
		});

		it("should return flag options when input starts with -", async () => {
			const cli = TestBaseCli()
				.globalFlag("verbose", "Enable verbose mode", {
					type: Boolean,
					alias: "v",
				})
				.globalFlag("output", "Output file", {
					type: String,
					alias: "o",
				})
				.command("build", "Build the project", {
					flags: {
						minify: {
							description: "Minify output",
							type: Boolean,
						},
					},
				});

			const env = {
				partial: "test build -",
				lastPartial: "-",
				complete: true,
				words: ["test", "build", "-"],
				point: 12,
			};

			const result = await getCompletion(cli, env as any);

			const names = result.map((c) => c.name);

			expect(names).toContain("--verbose");
			expect(names).toContain("-v");
			expect(names).toContain("--output");
			expect(names).toContain("-o");
			expect(names).toContain("--minify");
		});

		it("should return command completions for non-option input", async () => {
			const cli = TestBaseCli()
				.command("build", "Build the project")
				.command("dev", "Start dev server")
				.command("test", "Run tests");

			const env = {
				partial: "test ",
				lastPartial: "",
				complete: true,
				words: ["test"],
				point: 5,
			};

			const result = await getCompletion(cli, env as any);

			const names = result.map((c) => c.name);

			expect(names).toContain("build");
			expect(names).toContain("dev");
			expect(names).toContain("test");
		});

		it("should filter commands by prefix", async () => {
			const cli = TestBaseCli()
				.command("build", "Build the project")
				.command("bundle", "Bundle the project")
				.command("dev", "Start dev server");

			const env = {
				partial: "test bu",
				lastPartial: "bu",
				complete: true,
				words: ["test", "bu"],
				point: 8,
			};

			const result = await getCompletion(cli, env as any);

			const names = result.map((c) => c.name);

			expect(names).toContain("build");
			expect(names).toContain("bundle");
		});

		it("should exclude commands with show: false", async () => {
			const cli = TestBaseCli()
				.command("build", "Build the project")
				.command("hidden", "Hidden command", {
					completions: {
						show: false,
					},
				});

			const env = {
				partial: "test ",
				lastPartial: "",
				complete: true,
				words: ["test"],
				point: 5,
			};

			const result = await getCompletion(cli, env as any);

			const names = result.map((c) => c.name);

			expect(names).toContain("build");
			expect(names).not.toContain("hidden");
		});

		it("should deduplicate completion candidates", async () => {
			const cli = TestBaseCli()
				.command("build", "Build the project")
				.command("build:prod", "Build for production")
				.command("build:dev", "Build for development");

			const env = {
				partial: "test build",
				lastPartial: "build",
				complete: true,
				words: ["test", "build"],
				point: 10,
			};

			const result = await getCompletion(cli, env as any);

			// Count how many times "build" appears
			const buildCount = result.filter((c) => c.name === "build").length;

			expect(buildCount).toBe(1);
		});

		it("should return global flags for root level option completion", async () => {
			const cli = TestBaseCli()
				.globalFlag("help", "Show help", {
					type: Boolean,
					alias: "h",
				})
				.command("test", "Test command");

			const env = {
				partial: "test -",
				lastPartial: "-",
				complete: true,
				words: ["test", "-"],
				point: 6,
			};

			const result = await getCompletion(cli, env as any);

			const names = result.map((c) => c.name);

			expect(names).toContain("--help");
			expect(names).toContain("-h");
		});

		it("should handle multi-word command names", async () => {
			const cli = TestBaseCli()
				.command("git commit", "Commit changes")
				.command("git push", "Push changes")
				.command("npm install", "Install packages");

			const env = {
				partial: "test git ",
				lastPartial: "",
				complete: true,
				words: ["test", "git", ""],
				point: 9,
			};

			const result = await getCompletion(cli, env as any);

			const names = result.map((c) => c.name);

			expect(names).toContain("commit");
			expect(names).toContain("push");
			expect(names).not.toContain("install");
		});

		it("should return suggestions when partial matches multi-word commands", async () => {
			const cli = TestBaseCli()
				.command("git commit", "Commit changes")
				.command("git push", "Push changes");

			const env = {
				partial: "test git c",
				lastPartial: "c",
				complete: true,
				words: ["test", "git", "c"],
				point: 9,
			};

			const result = await getCompletion(cli, env as any);

			// Should suggest "commit" as the next word
			const names = result.map((c) => c.name);

			expect(names.length).toBeGreaterThan(0);
		});

		it("should handle quoted strings in input", async () => {
			const cli = TestBaseCli().command("commit", "Commit");

			const env = {
				partial: 'test "some arg" ',
				lastPartial: "",
				complete: true,
				words: ["test", '"some arg"', ""],
				point: 16,
			};

			await getCompletion(cli, env as any);
		});

		it("should suggest subcommands after resolved command", async () => {
			const cli = TestBaseCli()
				.command("git", "Git")
				.command("git commit", "Commit");

			const env = {
				partial: "test git ",
				lastPartial: "",
				complete: true,
				words: ["test", "git", ""],
				point: 9,
			};

			const result = await getCompletion(cli, env as any);

			const names = result.map((c) => c.name);

			expect(names).toContain("commit");
		});

		it("should handle escaped characters", async () => {
			const cli = TestBaseCli().command("commit", "Commit");

			const env = {
				partial: 'test "some\\ arg" ',
				lastPartial: "",
				complete: true,
				words: ["test", '"some\\ arg"', ""],
				point: 17,
			};

			await getCompletion(cli, env as any);
		});
	});
});
