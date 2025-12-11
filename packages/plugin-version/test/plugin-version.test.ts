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

	it('should be able to disable command with "command: false"', async () => {
		await expect(async () => {
			await Cli()
				.use(versionPlugin({ command: false }))
				.parse(["version"]);
		}).rejects.toThrow('No such command: "version".');

		expect(console).not.toHaveLogged();
	});

	it('should be able to disable flag with "flag: false"', async () => {
		await expect(async () => {
			await Cli()
				.use(versionPlugin({ flag: false }))
				.parse(["--version"]);
		}).rejects.toThrow("No command specified.");

		expect(console).not.toHaveLogged();
	});
});
