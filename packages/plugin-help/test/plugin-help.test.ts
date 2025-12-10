import { Cli } from "@clerc/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { helpPlugin } from "../src";

describe("plugin-help", () => {
	const processStdoutWriteSpy = vi
		.spyOn(process.stdout, "write")
		.mockImplementation(() => true);

	afterEach(() => {
		processStdoutWriteSpy.mockClear();
	});

	it("should show help", () => {
		Cli().use(helpPlugin()).parse(["help"]);

		expect(processStdoutWriteSpy).toHaveBeenCalled();
		expect(processStdoutWriteSpy.mock.calls[0][0]).toMatchSnapshot();
	});

	it("should show --help", () => {
		Cli().use(helpPlugin()).parse(["--help"]);

		expect(processStdoutWriteSpy).toHaveBeenCalled();
		expect(processStdoutWriteSpy.mock.calls[0][0]).toMatchSnapshot();
	});

	it("should show help when no command", () => {
		Cli().use(helpPlugin()).parse([]);

		expect(processStdoutWriteSpy).toHaveBeenCalled();
		expect(processStdoutWriteSpy.mock.calls[0][0]).toMatchSnapshot();
	});
});
