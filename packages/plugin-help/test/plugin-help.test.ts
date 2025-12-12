import { TestBaseCli, getConsoleMock } from "@clerc/test-utils";
import { Constraints, NoSuchCommandError, friendlyErrorPlugin } from "clerc";
import * as kons from "kons";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { mockConsole } from "vitest-console";

import { helpPlugin } from "../src";

const { Enum, Range } = Constraints;

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

	it("should show parameter constraints", () => {
		const constraintEnum = Constraints.Enum("a", "b", "c");
		TestBaseCli()
			.use(helpPlugin())
			.command("test", "Test command", {
				parameters: [
					"<param>",
					{
						key: "<param2>",
						constraint: constraintEnum,
					},
					{
						key: "[range]",
						constraint: Range(1, 10),
					},
				],
			})
			.parse(["test", "--help"]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should use [] as placeholder when root command exists", () => {
		TestBaseCli().use(helpPlugin()).command("", "Root command").parse(["help"]);

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
