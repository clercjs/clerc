import { TestBaseCli } from "@clerc/test-utils";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { mockConsole } from "vitest-console";

import { updateNotifierPlugin } from "../src";

// Mock update-notifier
vi.mock("update-notifier", () => ({
  default: vi.fn((options) => {
    const mockNotifier = {
      update: null as any,
      notify: vi.fn(),
      options,
    };

    // Store the notifier instance for test access
    (updateNotifierPlugin as any).__mockNotifier = mockNotifier;

    return mockNotifier;
  }),
}));

describe("plugin-update-notifier", () => {
  const { clearConsole, restoreConsole } = mockConsole({ quiet: true });

  afterEach(() => {
    clearConsole();
    vi.clearAllMocks();
  });

  afterAll(restoreConsole);

  const pkg = { name: "my-cli", version: "1.2.3" };

  it("should accept custom package info", () => {
    const cli = TestBaseCli().use(updateNotifierPlugin({ pkg }));

    cli.parse(["--help"]).catch(() => {});

    const mockNotifier = (updateNotifierPlugin as any).__mockNotifier;

    expect(mockNotifier.options.pkg.name).toBe("my-cli");
    expect(mockNotifier.options.pkg.version).toBe("1.2.3");
  });

  it("should use custom update check interval", () => {
    const customInterval = 1000 * 60 * 60; // 1 hour
    const cli = TestBaseCli().use(
      updateNotifierPlugin({ pkg, updateCheckInterval: customInterval }),
    );

    cli.parse(["--help"]).catch(() => {});

    const mockNotifier = (updateNotifierPlugin as any).__mockNotifier;

    expect(mockNotifier.options.updateCheckInterval).toBe(customInterval);
  });

  it("should show notification using default notify method when update is available", () => {
    const cli = TestBaseCli()
      .use(updateNotifierPlugin({ pkg }))
      .command("test", "test")
      .on("test", () => {});

    // Simulate an update being available
    const mockNotifier = (updateNotifierPlugin as any).__mockNotifier;
    mockNotifier.update = {
      latest: "2.0.0",
      current: "1.0.0",
      type: "major",
      name: "test",
    };

    cli.parse(["test"]);

    expect(mockNotifier.notify).toHaveBeenCalled();
  });

  it.todo("should show custom message when update is available", () => {
    const customMessage = "Update available! Please upgrade.";
    const cli = TestBaseCli()
      .use(updateNotifierPlugin({ pkg, notify: { message: customMessage } }))
      .command("test", "test")
      .on("test", () => {});

    const mockNotifier = (updateNotifierPlugin as any).__mockNotifier;
    mockNotifier.update = {
      latest: "2.0.0",
      current: "1.0.0",
      type: "major",
      name: "test",
    };

    cli.parse(["test"]);

    expect(console).toHaveLoggedWith(customMessage);
  });

  it.todo("should support custom message function", () => {
    const messageFunction = vi.fn(
      (notifier) =>
        `Update from ${notifier.update.current} to ${notifier.update.latest}`,
    );

    const cli = TestBaseCli()
      .use(updateNotifierPlugin({ pkg, notify: { message: messageFunction } }))
      .command("test", "test")
      .on("test", () => {});

    const mockNotifier = (updateNotifierPlugin as any).__mockNotifier;
    mockNotifier.update = {
      latest: "2.0.0",
      current: "1.0.0",
      type: "major",
      name: "test",
    };

    cli.parse(["test"]);

    expect(messageFunction).toHaveBeenCalledWith(mockNotifier);
    expect(console).toHaveLoggedWith("Update from 1.0.0 to 2.0.0");
  });

  it("should store notifier in context", () => {
    const cli = TestBaseCli()
      .use(updateNotifierPlugin({ pkg }))
      .command("test", "test")
      .on("test", (ctx) => {
        expect(ctx.store.updateNotifier).toBeDefined();
      });

    cli.parse(["test"]);
  });
});
