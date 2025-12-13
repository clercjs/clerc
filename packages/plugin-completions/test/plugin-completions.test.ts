import { TestBaseCli } from "@clerc/test-utils";
import { describe, expect, it } from "vitest";

import { completionsPlugin } from "../src";

describe("plugin-completions", () => {
	it("should register completions commands by default", () => {
		const cli = TestBaseCli().use(completionsPlugin());

		// Check if commands are registered
		expect(cli._commands.has("completions install")).toBeTruthy();
		expect(cli._commands.has("completions uninstall")).toBeTruthy();
		expect(cli._commands.has("completions")).toBeTruthy();
		expect(cli._commands.has("completion-server")).toBeTruthy();
	});

	it("should not register management commands when disabled", () => {
		const cli = TestBaseCli().use(
			completionsPlugin({ managementCommands: false }),
		);

		expect(cli._commands.has("completions install")).toBeFalsy();
		expect(cli._commands.has("completions uninstall")).toBeFalsy();
		expect(cli._commands.has("completions")).toBeTruthy();
		expect(cli._commands.has("completion-server")).toBeTruthy();
	});

	it("should have completions command with proper configuration", () => {
		const cli = TestBaseCli().use(completionsPlugin());
		const completionsCmd = cli._commands.get("completions");

		expect(completionsCmd).toBeDefined();
		expect(completionsCmd?.flags).toBeDefined();
		expect(completionsCmd?.flags?.shell).toBeDefined();
	});

	it("should have completion-server command hidden from help", () => {
		const cli = TestBaseCli().use(completionsPlugin());
		const completionServerCmd = cli._commands.get("completion-server");

		expect(completionServerCmd).toBeDefined();
		expect(completionServerCmd?.help?.show).toBeFalsy();
	});

	it("should support command completions options", () => {
		const cli = TestBaseCli()
			.use(completionsPlugin())
			.command("test", "test command", {
				completions: {
					show: false,
				},
			});

		const cmd = cli._commands.get("test");

		expect(cmd?.completions?.show).toBeFalsy();
	});

	it("should have install and uninstall commands with proper configuration", () => {
		const cli = TestBaseCli().use(completionsPlugin());

		const installCmd = cli._commands.get("completions install");

		expect(installCmd).toBeDefined();
		expect(installCmd?.flags).toBeDefined();
		expect(installCmd?.flags?.shell).toBeDefined();

		const uninstallCmd = cli._commands.get("completions uninstall");

		expect(uninstallCmd).toBeDefined();
	});

	it("should return cli instance from plugin setup", () => {
		const cli = TestBaseCli();
		const result = cli.use(completionsPlugin());

		expect(result).toBe(cli);
	});
});
