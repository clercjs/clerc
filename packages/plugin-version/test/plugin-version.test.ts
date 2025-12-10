import { Cli } from "@clerc/test-utils";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { mockConsole } from "vitest-console";

import { versionPlugin } from "../src";

describe("plugin-version", () => {
	const { clearConsole, restoreConsole } = mockConsole({ quiet: true });

	afterEach(clearConsole);

	afterAll(restoreConsole);

	it("should show version command output", () => {
		Cli().use(versionPlugin()).parse(["version"]);

		expect(console).toHaveLoggedWith("v0.0.0");
	});

	it("should show version flag output", () => {
		Cli().use(versionPlugin()).parse(["--version"]);

		expect(console).toHaveLoggedWith("v0.0.0");
	});

	it('should be able to disable command with "command: false"', () => {
		Cli()
			.use(versionPlugin({ command: false }))
			.errorHandler((err: any) => {
				expect(err).toMatchInlineSnapshot(
					`[Error: No such command: "version".]`,
				);
			})
			.parse(["version"]);

		expect(console).not.toHaveLogged();
	});

	it('should be able to disable flag with "flag: false"', () => {
		Cli()
			.use(versionPlugin({ flag: false }))
			.errorHandler((err: any) => {
				expect(err).toMatchInlineSnapshot("[Error: No command specified.]");
			})
			.parse(["--version"]);

		expect(console).not.toHaveLogged();
	});
});
