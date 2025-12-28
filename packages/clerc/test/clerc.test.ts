import { TestCli, getConsoleMock } from "@clerc/test-utils";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { mockConsole } from "vitest-console";

describe("clerc", () => {
  const { clearConsole, restoreConsole } = mockConsole({ quiet: true });

  afterEach(clearConsole);

  afterAll(restoreConsole);

  it("should install plugins", async () => {
    await TestCli().parse([]);
    await TestCli().parse(["help"]);
    await TestCli().parse(["--help"]);
    await TestCli().parse(["version"]);
    await TestCli().parse(["--version"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });
});
