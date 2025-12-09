import { Cli } from "@clerc/test-utils";
import { describe, expect, it, vi } from "vitest";

import { notFoundPlugin } from "../src";

async function testConsoleError(fn: () => void | Promise<void>) {
	const spy = vi.spyOn(console, "error");
	const exitSpy = vi.spyOn(process, "exit");
	const msgs: string[] = [];

	spy.mockImplementation((msg) => {
		msgs.push(msg);
	});
	exitSpy.mockImplementation(() => ({}) as never);

	try {
		await fn();
		await new Promise((resolve) => setTimeout(resolve, 100));
	} finally {
		spy.mockRestore();
		exitSpy.mockRestore();
	}

	return msgs;
}

describe("plugin-not-found", () => {
	it("should show commands", async () => {
		const msgs = await testConsoleError(() => {
			Cli().use(notFoundPlugin()).parse([]);
		});

		expect(msgs).toMatchInlineSnapshot(`
      [
        "No command specified.",
      ]
    `);
	});

	it("should show closest command", async () => {
		const msgs = await testConsoleError(() => {
			Cli().use(notFoundPlugin()).command("foo", "foo command").parse(["fo"]);
		});

		expect(msgs).toMatchInlineSnapshot(`
			[
			  "Command "[9mfo[29m" not found.",
			  "Did you mean "[1mfoo[22m"?",
			]
		`);
	});
});
