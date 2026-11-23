import { describe, expect, it } from "vitest";

import {
  ClercError,
  createTheme,
  formatDiagnostic,
  formatJsonError,
} from "../src";

describe("Theme and Diagnostic Formatter", () => {
  it("applies ANSI colors only when theme is enabled", () => {
    const colored = createTheme(true);
    const plain = createTheme(false);

    expect(colored.error("error:")).toContain("\u001B[");
    expect(colored.flag("--port")).toContain("\u001B[");
    expect(plain.flag("--port")).toBe("--port");
    expect(plain.error("error:")).toBe("error:");
  });

  it("formats ClercError with Cargo/Clap diagnostic layout and JSON", () => {
    const err = new ClercError("unknown command 'buid'", {
      code: "ERR_UNKNOWN_COMMAND",
      exitCode: 2,
      hints: ["a similar command exists: 'build'"],
      usage: "test <command> [options]",
    });

    const output = formatDiagnostic(err, {
      theme: createTheme(false),
      name: "test",
    });

    expect(output).toBe(
      [
        "error  unknown command 'buid'",
        "",
        "  tip  a similar command exists: 'build'",
        "",
        "usage  test <command> [options]",
        "",
        "       For more information, try 'test --help'.",
      ].join("\n"),
    );

    expect(JSON.parse(formatJsonError(err))).toEqual({
      error: {
        code: "ERR_UNKNOWN_COMMAND",
        message: "unknown command 'buid'",
        hints: ["a similar command exists: 'build'"],
        exitCode: 2,
      },
    });
  });
});
