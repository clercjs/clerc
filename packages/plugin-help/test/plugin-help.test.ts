// TODO: fix tests

import { helpPlugin } from "@clerc/plugin-help";
import { Cli } from "@clerc/test-utils";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const NEWLINE_RE = /\r?\n/g;

describe("plugin-help", () => {
	const msgs: string[] = [];

	beforeAll(() => {
		(process.stdout.write as any) = (s: string) => {
			msgs.push(s.replace(NEWLINE_RE, "\n"));
		};
	});

	afterEach(() => {
		msgs.length = 0;
	});

	it("should show help", () => {
		Cli().use(helpPlugin()).parse(["help"]);

		expect(msgs).toMatchInlineSnapshot(`
			[
			  "[1mName:[22m     [31mtest[39m
			[1mVersion:[22m  [33m0.0.0[39m

			[1mDescription:[22m

			    test

			[1mUsage:[22m

			    [35m$ test <command> [flags][39m

			[1mCommands:[22m

			    [36mtest help[39m  [33m-[39m  Show help

			[1mGlobal Flags:[22m

			    [34m--help, -h[39m    [33m-[39m  Show help  (Default: false)
			",
			]
		`);
	});

	it("should show --help", () => {
		Cli().use(helpPlugin()).parse(["--help"]);

		expect(msgs).toMatchInlineSnapshot(`
			[
			  "[1mName:[22m     [31mtest[39m
			[1mVersion:[22m  [33m0.0.0[39m

			[1mDescription:[22m

			    test

			[1mUsage:[22m

			    [35m$ test <command> [flags][39m

			[1mCommands:[22m

			    [36mtest help[39m  [33m-[39m  Show help

			[1mGlobal Flags:[22m

			    [34m--help, -h[39m    [33m-[39m  Show help  (Default: false)
			",
			]
		`);
	});

	it("should show name, description and version", () => {
		Cli().use(helpPlugin()).parse(["help"]);

		expect(msgs).toMatchInlineSnapshot(`
			[
			  "[1mName:[22m     [31mtest[39m
			[1mVersion:[22m  [33m0.0.0[39m

			[1mDescription:[22m

			    test

			[1mUsage:[22m

			    [35m$ test <command> [flags][39m

			[1mCommands:[22m

			    [36mtest help[39m  [33m-[39m  Show help

			[1mGlobal Flags:[22m

			    [34m--help, -h[39m    [33m-[39m  Show help  (Default: false)
			",
			]
		`);
	});
});
