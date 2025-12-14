import { TestBaseCli, getConsoleMock } from "@clerc/test-utils";
import { Clerc, NoSuchCommandError, Types, friendlyErrorPlugin } from "clerc";
import * as kons from "kons";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { mockConsole } from "vitest-console";

import { helpPlugin } from "../src";

vi.mock("kons", () => ({
	error: vi.fn(),
}));

describe("plugin-help", () => {
	vi.spyOn(process, "exit").mockImplementation(() => ({}) as never);
	const spy = vi.spyOn(kons, "error").mockImplementation(() => {});
	vi.mocked(kons.error).mockImplementation(() => {});

	afterEach(() => {
		spy.mockClear();
	});

	const { clearConsole, restoreConsole } = mockConsole({ quiet: true });

	afterEach(clearConsole);

	afterAll(restoreConsole);

	it("should show help", () => {
		TestBaseCli().use(helpPlugin()).parse(["help"]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should show --help", () => {
		TestBaseCli().use(helpPlugin()).parse(["--help"]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should show help when no command", () => {
		TestBaseCli().use(helpPlugin()).parse([]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should show parameter types", () => {
		TestBaseCli()
			.use(helpPlugin())
			.command("test", "Test command", {
				parameters: [
					"<param>",
					{
						key: "<param2>",
						type: Types.Enum("a", "b", "c"),
					},
					{
						key: "[range]",
						type: Types.Range(1, 10),
					},
					{
						key: "[regex]",
						type: Types.Regex(/^\d+$/),
					},
				],
			})
			.parse(["test", "--help"]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should show parameter description", () => {
		TestBaseCli()
			.use(helpPlugin())
			.command("test", "Test command", {
				parameters: [
					{
						key: "<param>",
						description: "Description for param",
					},
				],
			})
			.parse(["test", "--help"]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should support optional description for command", () => {
		TestBaseCli().use(helpPlugin()).command("test").parse(["--help"]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should support flag shorthand", () => {
		TestBaseCli()
			.use(helpPlugin())
			.command("test", "Test command", {
				flags: {
					verbose: Boolean,
				},
			})
			.parse(["test", "--help"]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should support optional description for global flag", () => {
		TestBaseCli()
			.use(helpPlugin())
			.globalFlag("verbose", {
				type: Boolean,
				description: "Enable verbose output",
			})
			.parse(["--help"]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should support no description", () => {
		Clerc.create()
			.scriptName("test")
			.version("1.0.0")
			.use(helpPlugin())
			.command("test", {
				parameters: [
					{
						key: "<param>",
					},
				],
				flags: {
					flag: {
						type: Boolean,
					},
				},
			})
			.globalFlag("global", {
				type: Boolean,
			})
			.parse(["test", "--help"]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should use [] as placeholder when root command exists", () => {
		TestBaseCli().use(helpPlugin()).command("", "Root command").parse(["help"]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should not show commands placeholder when no commands exist", () => {
		TestBaseCli()
			.use(helpPlugin({ command: false }))
			.parse(["--help"]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should not show commands placeholder when only registered root command", () => {
		TestBaseCli()
			.use(helpPlugin({ command: false }))
			.command("")
			.parse(["--help"]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should not show commands which set `show` to false", () => {
		TestBaseCli()
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
			TestBaseCli()
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
			TestBaseCli()
				.use(
					helpPlugin({
						groups: {
							globalFlags: [["output", "Output Options"]],
						},
					}),
				)
				.globalFlag("verbose", "Enable verbose output", {
					type: Boolean,
					short: "v",
					help: { group: "output" },
				})
				.globalFlag("quiet", "Suppress output", {
					type: Boolean,
					short: "q",
					help: { group: "output" },
				})
				.globalFlag("config", "Config file path", {
					type: String,
				})
				.parse([]);

			expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
		});

		it("should group command flags", () => {
			TestBaseCli()
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
				await TestBaseCli()
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
			TestBaseCli()
				.use(helpPlugin())
				.command("init", "Initialize project")
				.command("build", "Build project")
				.parse([]);

			expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
		});

		it("should display subcommands", () => {
			TestBaseCli()
				.use(helpPlugin())
				.command("parent", "Parent command")
				.command("parent child1", "First child command")
				.command("parent child2", "Second child command")
				.parse(["parent", "--help"]);

			TestBaseCli()
				.use(helpPlugin())
				.command("", "Parent command")
				.command("child1", "First child command")
				.command("child2", "Second child command")
				.parse(["--help"]);

			expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
		});
	});

	it("should throw error when command not found", async () => {
		await expect(async () => {
			await TestBaseCli().use(helpPlugin()).parse(["not-exist", "--help"]);
		}).rejects.toThrow(NoSuchCommandError);

		await expect(async () => {
			await TestBaseCli().use(helpPlugin()).parse(["help", "not-exist"]);
		}).rejects.toThrow(NoSuchCommandError);
	});

	it("should show available subcommands when parent command does not exist", () => {
		TestBaseCli()
			.use(helpPlugin())
			.command("completions install", "Install shell completions")
			.command("completions uninstall", "Uninstall shell completions")
			.parse(["help", "completions"]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should show available subcommands when parent command does not exist (using --help)", () => {
		TestBaseCli()
			.use(helpPlugin())
			.command("completions install", "Install shell completions")
			.command("completions uninstall", "Uninstall shell completions")
			.parse(["completions", "--help"]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should still throw error when no subcommands exist for non-existent command", async () => {
		await expect(async () => {
			await TestBaseCli()
				.use(helpPlugin())
				.command("other", "Other command")
				.parse(["help", "not-exist"]);
		}).rejects.toThrow(NoSuchCommandError);
	});

	it("should work with friendly-error", async () => {
		expect(async () => {
			await TestBaseCli()
				.use(helpPlugin())
				.use(friendlyErrorPlugin())
				.parse(["not-exist", "--help"]);

			expect(spy.mock.calls).toMatchSnapshot();
		}).not.toThrow();
	});

	it('should format custom flag type with "display" property', () => {
		const customType = (val: string) => val;
		customType.display = "custom-type";

		TestBaseCli()
			.use(helpPlugin())
			.globalFlag("custom", "A flag with custom type", {
				type: customType,
			})
			.parse(["--help"]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it('should format custom flag default with "display" property', () => {
		const defaultFn = () => "string";
		defaultFn.display = "custom-default";

		TestBaseCli()
			.use(helpPlugin())
			.globalFlag("custom", "A flag with custom default", {
				type: String,
				default: defaultFn,
			})
			.parse(["--help"]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});
});
