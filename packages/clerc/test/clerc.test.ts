import { Cli } from "@clerc/test-utils";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { mockConsole } from "vitest-console";

import { Clerc } from "../src";

describe("clerc", () => {
	const { clearConsole, restoreConsole } = mockConsole({ quiet: true });

	afterEach(clearConsole);

	afterAll(restoreConsole);

	it("should extend BaseClerc", async () => {
		expect(async () => {
			await Cli(Clerc as any).parse([]);
			await Cli(Clerc as any).parse(["help"]);
			await Cli(Clerc as any).parse(["--help"]);
			await Cli(Clerc as any).parse(["version"]);
			await Cli(Clerc as any).parse(["--version"]);
		}).not.toThrow();
	});
});
