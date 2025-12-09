import { Cli } from "@clerc/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { helpPlugin } from "../src";

describe("plugin-help", () => {
	const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

	afterEach(() => {
		consoleLogSpy.mockClear();
	});

	it("should show help", () => {
		Cli().use(helpPlugin()).parse(["help"]);

		expect(consoleLogSpy).toHaveBeenCalled();
		expect(consoleLogSpy.mock.calls[0][0]).toMatchSnapshot();
	});

	it("should show --help", () => {
		Cli().use(helpPlugin()).parse(["--help"]);

		expect(consoleLogSpy).toHaveBeenCalled();
		expect(consoleLogSpy.mock.calls[0][0]).toMatchSnapshot();
	});

	it("should show help when no command", () => {
		Cli().use(helpPlugin()).parse([]);

		expect(consoleLogSpy).toHaveBeenCalled();
		expect(consoleLogSpy.mock.calls[0][0]).toMatchSnapshot();
	});
});
