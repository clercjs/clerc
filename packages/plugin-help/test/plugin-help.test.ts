import { Cli, getConsoleMock } from "@clerc/test-utils";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { mockConsole } from "vitest-console";

import { helpPlugin } from "../src";

describe("plugin-help", () => {
	const { clearConsole, restoreConsole } = mockConsole({ quiet: true });

	afterEach(clearConsole);

	afterAll(restoreConsole);

	it("should show help", () => {
		Cli().use(helpPlugin()).parse(["help"]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should show --help", () => {
		Cli().use(helpPlugin()).parse(["--help"]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should show help when no command", () => {
		Cli().use(helpPlugin()).parse([]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});

	it("should not show commands which set `showInHelp` to false", () => {
		Cli()
			.use(helpPlugin())
			.command("test", "", {
				help: {
					showInHelp: false,
				},
			})
			.parse([]);

		expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
	});
});
