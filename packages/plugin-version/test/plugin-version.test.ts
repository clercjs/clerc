import { Cli } from "@clerc/test-utils";
import { describe, expect, it, vi } from "vitest";

import { versionPlugin } from "../src";

function testStdoutWrite(expectedOutput: string, fn: () => void) {
	const spy = vi.spyOn(process.stdout, "write");

	spy.mockImplementation((arg) => {
		expect(arg).toContain(expectedOutput);

		return true;
	});

	try {
		fn();
	} finally {
		spy.mockRestore();
	}
}

describe("plugin-version", () => {
	it("should show version command output", () => {
		testStdoutWrite("v0.0.0", () => {
			Cli().use(versionPlugin()).parse(["version"]);
		});
	});

	it("should show version flag output", () => {
		testStdoutWrite("v0.0.0", () => {
			Cli().use(versionPlugin()).parse(["--version"]);
		});
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
	});

	it('should be able to disable flag with "flag: false"', () => {
		Cli()
			.use(versionPlugin({ flag: false }))
			.errorHandler((err: any) => {
				expect(err).toMatchInlineSnapshot("[Error: No command specified.]");
			})
			.parse(["--version"]);
	});
});
