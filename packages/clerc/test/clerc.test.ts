import { TestCli } from "@clerc/test-utils";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { mockConsole } from "vitest-console";

describe("clerc", () => {
	const { clearConsole, restoreConsole } = mockConsole({ quiet: true });

	afterEach(clearConsole);

	afterAll(restoreConsole);

	it("should extend BaseClerc", async () => {
		expect(async () => {
			await TestCli().parse([]);
			await TestCli().parse(["help"]);
			await TestCli().parse(["--help"]);
			await TestCli().parse(["version"]);
			await TestCli().parse(["--version"]);
		}).not.toThrow();
	});
});
