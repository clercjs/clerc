import { Cli } from "@clerc/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { versionPlugin } from "../src";

describe("plugin-version", () => {
	const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

	afterEach(() => {
		spy.mockClear();
	});

	it("should show version command output", () => {
		Cli().use(versionPlugin()).parse(["version"]);

		expect(spy).toHaveBeenCalledWith("v0.0.0");
	});

	it("should show version flag output", () => {
		Cli().use(versionPlugin()).parse(["--version"]);

		expect(spy).toHaveBeenCalledWith("v0.0.0");
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

		expect(spy).toHaveBeenCalledTimes(0);
	});

	it('should be able to disable flag with "flag: false"', () => {
		Cli()
			.use(versionPlugin({ flag: false }))
			.errorHandler((err: any) => {
				expect(err).toMatchInlineSnapshot("[Error: No command specified.]");
			})
			.parse(["--version"]);

		expect(spy).toHaveBeenCalledTimes(0);
	});
});
