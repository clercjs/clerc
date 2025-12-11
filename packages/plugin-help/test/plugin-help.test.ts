import { TestCli, getConsoleMock } from "@clerc/test-utils";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { mockConsole } from "vitest-console";

import { helpPlugin } from "../src";

describe("plugin-help", () => {
	const { clearConsole, restoreConsole } = mockConsole({ quiet: true });

	afterEach(clearConsole);

	afterAll(restoreConsole);

	it("should show help", () => {
		TestCli().use(helpPlugin()).parse(["help"]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should show --help", () => {
		TestCli().use(helpPlugin()).parse(["--help"]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should show help when no command", () => {
		TestCli().use(helpPlugin()).parse([]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should not show commands which set `show` to false", () => {
		TestCli()
			.use(helpPlugin())
			.command("test", "", {
				help: {
					show: false,
				},
			})
			.parse([]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	describe("grouping", () => {
		it("should group commands", () => {
			TestCli()
				.use(
					helpPlugin({
						groups: {
							commands: [
								["core", "Core Commands"],
								["util", "Utility Commands"],
							],
						},
					}),
				)
				.command("init", "Initialize project", {
					help: { group: "core" },
				})
				.command("build", "Build project", {
					help: { group: "core" },
				})
				.command("clean", "Clean build artifacts", {
					help: { group: "util" },
				})
				.command("other", "Other command")
				.parse([]);

			expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
		});

		it("should group global flags", () => {
			TestCli()
				.use(
					helpPlugin({
						groups: {
							globalFlags: [["output", "Output Options"]],
						},
					}),
				)
				.globalFlag("verbose", "Enable verbose output", {
					type: Boolean,
					alias: "v",
					help: { group: "output" },
				})
				.globalFlag("quiet", "Suppress output", {
					type: Boolean,
					alias: "q",
					help: { group: "output" },
				})
				.globalFlag("config", "Config file path", {
					type: String,
				})
				.parse([]);

			expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
		});

		it("should group command flags", () => {
			TestCli()
				.use(
					helpPlugin({
						groups: {
							flags: [["input", "Input Options"]],
						},
					}),
				)
				.command("build", "Build project", {
					flags: {
						src: {
							type: String,
							description: "Source directory",
							help: { group: "input" },
						},
						entry: {
							type: String,
							description: "Entry file",
							help: { group: "input" },
						},
						output: {
							type: String,
							description: "Output directory",
						},
					},
				})
				.parse(["build", "--help"]);

			expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
		});

		it("should throw error for undefined group", async () => {
			await expect(async () => {
				await TestCli()
					.use(
						helpPlugin({
							groups: {
								commands: [["core", "Core Commands"]],
							},
						}),
					)
					.command("init", "Initialize project", {
						help: { group: "undefined-group" },
					})
					.parse([]);
			}).rejects.toThrowErrorMatchingInlineSnapshot(
				`[Error: Unknown command group "undefined-group" for "init". Available groups: core]`,
			);
		});

		it("should not add group headers when no groups defined", () => {
			TestCli()
				.use(helpPlugin())
				.command("init", "Initialize project")
				.command("build", "Build project")
				.parse([]);

			expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
		});
	});
});
