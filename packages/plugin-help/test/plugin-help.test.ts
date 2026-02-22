import { TestBaseCli, getConsoleMock } from "@clerc/test-utils";
import { Clerc, NoSuchCommandError, Types, friendlyErrorPlugin } from "clerc";
import * as kons from "kons";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { mockConsole } from "vitest-console";

import { helpPlugin } from "../src";

vi.mock("kons", () => ({
  error: vi.fn(),
}));

describe("plugin-help", () => {
  vi.spyOn(process, "exit").mockImplementation(() => ({}) as never);
  const spy = vi.spyOn(kons, "error").mockImplementation(() => {});
  vi.mocked(kons.error).mockImplementation(() => {});

  afterEach(() => {
    spy.mockClear();
  });

  const { clearConsole, restoreConsole } = mockConsole({ quiet: true });

  afterEach(clearConsole);

  afterAll(restoreConsole);

  it("should show help", async () => {
    await TestBaseCli().use(helpPlugin()).parse(["help"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  it("should show --help", async () => {
    await TestBaseCli().use(helpPlugin()).parse(["--help"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  it("should show help when no command", async () => {
    await TestBaseCli().use(helpPlugin()).parse([]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  it("should show parameter types", async () => {
    await TestBaseCli()
      .use(helpPlugin())
      .command("test", "Test command", {
        parameters: [
          "<param>",
          {
            key: "<param2>",
            type: Types.Enum("a", "b", "c"),
          },
          {
            key: "[range]",
            type: Types.Range(1, 10),
          },
          {
            key: "[regex]",
            type: Types.Regex(/^\d+$/),
          },
          "--",
        ],
      })
      .parse(["test", "--help"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  it('should show parameter type as "string" or "Array<string>" when type is not specified', async () => {
    await TestBaseCli()
      .use(helpPlugin())
      .command("test", "Test command", {
        parameters: ["<param1>", "<param2...>"],
      })
      .parse(["test", "--help"]);

    await TestBaseCli()
      .use(helpPlugin())
      .command("test", "Test command", {
        parameters: ["[param1]", "[param2...]"],
      })
      .parse(["test", "--help"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  it("should hide double dash in parameters section", async () => {
    await TestBaseCli()
      .use(helpPlugin())
      .command("test", "Test command", {
        parameters: ["--"],
      })
      .parse(["test", "--help"]);

    await TestBaseCli()
      .use(helpPlugin())
      .command("test", "Test command", {
        parameters: ["--"],
      })
      .parse(["test", "--help"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  it("should handle optional double dash", async () => {
    await TestBaseCli()
      .use(helpPlugin())
      .command("test", "Test command", {
        parameters: ["--"],
      })
      .parse(["test", "--help"]);

    await TestBaseCli()
      .use(helpPlugin())
      .command("test", "Test command", {
        parameters: ["--", "[optional]"],
      })
      .parse(["test", "--help"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  it("should show parameter description", async () => {
    await TestBaseCli()
      .use(helpPlugin())
      .command("test", "Test command", {
        parameters: [
          {
            key: "<param>",
            description: "Description for param",
          },
        ],
      })
      .parse(["test", "--help"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  it("should support optional description for command", async () => {
    await TestBaseCli().use(helpPlugin()).command("test").parse(["--help"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  it("should support flag shorthand", async () => {
    await TestBaseCli()
      .use(helpPlugin())
      .command("test", "Test command", {
        flags: {
          verbose: Boolean,
        },
      })
      .parse(["test", "--help"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  it("should support optional description for global flag", async () => {
    await TestBaseCli()
      .use(helpPlugin())
      .globalFlag("verbose", {
        type: Boolean,
        description: "Enable verbose output",
      })
      .parse(["--help"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  it("should support no description", async () => {
    await Clerc.create()
      .scriptName("test")
      .version("1.0.0")
      .use(helpPlugin())
      .command("test", {
        parameters: [
          {
            key: "<param>",
          },
        ],
        flags: {
          flag: {
            type: Boolean,
          },
        },
      })
      .globalFlag("global", {
        type: Boolean,
      })
      .parse(["test", "--help"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  it("should use [] as placeholder when root command exists", async () => {
    await TestBaseCli()
      .use(helpPlugin())
      .command("", "Root command")
      .parse(["help"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  it("should not show commands placeholder when no commands exist", async () => {
    await TestBaseCli()
      .use(helpPlugin({ command: false }))
      .parse(["--help"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  it("should not show commands placeholder when only registered root command", async () => {
    await TestBaseCli()
      .use(helpPlugin({ command: false }))
      .command("")
      .parse(["--help"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  it("should not show commands which set `show` to false", async () => {
    await TestBaseCli()
      .use(helpPlugin())
      .command("test", "", {
        help: {
          show: false,
        },
      })
      .parse([]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  it("should not show Commands section when all commands are hidden", async () => {
    await TestBaseCli()
      .use(helpPlugin({ command: false }))
      .command("test", "", {
        help: {
          show: false,
        },
      })
      .parse(["-h"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  it("should show examples and notes", async () => {
    await TestBaseCli()
      .use(helpPlugin())
      .command("test", "Test command", {
        help: {
          examples: [
            ["$ cli test --foo", "Run test with foo"],
            ["$ cli test --bar", "Run test with bar"],
          ],
          notes: [
            "This is a note for the test command.",
            "Another note for users to read.",
          ],
        },
      })
      .parse(["test", "--help"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  describe("grouping", () => {
    it("should group commands", async () => {
      await TestBaseCli()
        .use(
          helpPlugin({
            groups: {
              commands: [
                ["core", "Core Commands"],
                ["util", "Utility Commands"],
              ],
            },
          }),
        )
        .command("init", "Initialize project", {
          help: { group: "core" },
        })
        .command("build", "Build project", {
          help: { group: "core" },
        })
        .command("clean", "Clean build artifacts", {
          help: { group: "util" },
        })
        .command("other", "Other command")
        .parse([]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should group global flags", async () => {
      await TestBaseCli()
        .use(
          helpPlugin({
            groups: {
              globalFlags: [["output", "Output Options"]],
            },
          }),
        )
        .globalFlag("verbose", "Enable verbose output", {
          type: Boolean,
          short: "v",
          help: { group: "output" },
        })
        .globalFlag("quiet", "Suppress output", {
          type: Boolean,
          short: "q",
          help: { group: "output" },
        })
        .globalFlag("config", "Config file path", {
          type: String,
        })
        .parse([]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should group command flags", async () => {
      await TestBaseCli()
        .use(
          helpPlugin({
            groups: {
              flags: [["input", "Input Options"]],
            },
          }),
        )
        .command("build", "Build project", {
          flags: {
            src: {
              type: String,
              description: "Source directory",
              help: { group: "input" },
            },
            entry: {
              type: String,
              description: "Entry file",
              help: { group: "input" },
            },
            output: {
              type: String,
              description: "Output directory",
            },
          },
        })
        .parse(["build", "--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should throw error for undefined group", async () => {
      await expect(
        TestBaseCli()
          .use(
            helpPlugin({
              groups: {
                commands: [["core", "Core Commands"]],
              },
            }),
          )
          .command("init", "Initialize project", {
            help: { group: "undefined-group" },
          })
          .parse([]),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `[Error: Unknown command group "undefined-group" for "init". Available groups: core]`,
      );
    });

    it("should not add group headers when no groups defined", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("init", "Initialize project")
        .command("build", "Build project")
        .parse([]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should display subcommands", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("parent", "Parent command")
        .command("parent child1", "First child command")
        .command("parent child2", "Second child command")
        .parse(["parent", "--help"]);

      await TestBaseCli()
        .use(helpPlugin())
        .command("", "Parent command")
        .command("child1", "First child command")
        .command("child2", "Second child command")
        .parse(["--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should not show flags which set `show` to false", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("test", "Test command", {
          flags: {
            visible: {
              type: Boolean,
              description: "Visible flag",
            },
            hidden: {
              type: Boolean,
              description: "Hidden flag",
              help: { show: false },
            },
          },
        })
        .parse(["test", "--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should not show global flags which set `show` to false", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .globalFlag("visible", "Visible global flag", {
          type: Boolean,
        })
        .globalFlag("hidden", "Hidden global flag", {
          type: Boolean,
          help: { show: false },
        })
        .parse(["--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should not show group header when all flags in group are hidden", async () => {
      await TestBaseCli()
        .use(
          helpPlugin({
            groups: {
              flags: [["hidden-group", "Hidden Group"]],
            },
          }),
        )
        .command("test", "Test command", {
          flags: {
            visible: {
              type: Boolean,
              description: "Visible flag",
            },
            hidden1: {
              type: Boolean,
              description: "Hidden flag 1",
              help: { group: "hidden-group", show: false },
            },
            hidden2: {
              type: Boolean,
              description: "Hidden flag 2",
              help: { group: "hidden-group", show: false },
            },
          },
        })
        .parse(["test", "--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should not show Flags section when all flags are hidden", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("test", "Test command", {
          flags: {
            hidden1: {
              type: Boolean,
              description: "Hidden flag 1",
              help: { show: false },
            },
            hidden2: {
              type: Boolean,
              description: "Hidden flag 2",
              help: { show: false },
            },
          },
        })
        .parse(["test", "--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should not show Global Flags section when all global flags are hidden", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .globalFlag("hidden1", "Hidden global flag 1", {
          type: Boolean,
          help: { show: false },
        })
        .globalFlag("hidden2", "Hidden global flag 2", {
          type: Boolean,
          help: { show: false },
        })
        .parse(["--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });
  });

  it("should throw error when command not found", async () => {
    await expect(
      TestBaseCli().use(helpPlugin()).parse(["not-exist", "--help"]),
    ).rejects.toThrowError(NoSuchCommandError);

    await expect(
      TestBaseCli().use(helpPlugin()).parse(["help", "not-exist"]),
    ).rejects.toThrowError(NoSuchCommandError);
  });

  it("should show available subcommands when parent command does not exist", async () => {
    await TestBaseCli()
      .use(helpPlugin())
      .command("completions install", "Install shell completions")
      .command("completions uninstall", "Uninstall shell completions")
      .parse(["help", "completions"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  it("should show available subcommands when parent command does not exist (using --help)", async () => {
    await TestBaseCli()
      .use(helpPlugin())
      .command("completions install", "Install shell completions")
      .command("completions uninstall", "Uninstall shell completions")
      .parse(["completions", "--help"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  it("should still throw error when no subcommands exist for non-existent command", async () => {
    await expect(
      TestBaseCli()
        .use(helpPlugin())
        .command("other", "Other command")
        .parse(["help", "not-exist"]),
    ).rejects.toThrowError(NoSuchCommandError);
  });

  it("should work with friendly-error", async () => {
    await TestBaseCli()
      .use(helpPlugin())
      .use(friendlyErrorPlugin())
      .parse(["not-exist", "--help"]);

    expect(spy.mock.calls).toMatchSnapshot();
  });

  it('should format custom flag type with "display" property', async () => {
    const customType = (val: string) => val;
    customType.display = "custom-type";

    await TestBaseCli()
      .use(helpPlugin())
      .globalFlag("custom", "A flag with custom type", {
        type: customType,
      })
      .parse(["--help"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  it('should format custom flag default with "display" property', async () => {
    const defaultFn = () => "string";
    defaultFn.display = "custom-default";

    await TestBaseCli()
      .use(helpPlugin())
      .globalFlag("custom", "A flag with custom default", {
        type: String,
        default: defaultFn,
      })
      .parse(["--help"]);

    expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
  });

  describe("negatable boolean flags", () => {
    it("should show --no-xxx syntax for negatable boolean flags (default)", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("test", "Test command", {
          flags: {
            verbose: {
              type: Boolean,
              description: "Enable verbose output",
              default: true,
            },
          },
        })
        .parse(["test", "--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should show --no-xxx syntax for boolean flag shorthand", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("test", "Test command", {
          flags: {
            verbose: {
              type: Boolean,
              default: true,
            },
          },
        })
        .parse(["test", "--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should show --no-xxx syntax for global boolean flags", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .globalFlag("verbose", "Enable verbose output", {
          type: Boolean,
          default: true,
        })
        .parse(["--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should NOT show --no-xxx syntax when negatable is explicitly false", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("test", "Test command", {
          flags: {
            strict: {
              type: Boolean,
              description: "Enable strict mode",
              negatable: false,
              default: true,
            },
          },
        })
        .parse(["test", "--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should NOT show --no-xxx syntax for non-boolean flags", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("test", "Test command", {
          flags: {
            count: {
              type: Number,
              description: "Count value",
            },
            name: {
              type: String,
              description: "Name value",
            },
          },
        })
        .parse(["test", "--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should show --no-xxx syntax along with short flag", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("test", "Test command", {
          flags: {
            verbose: {
              type: Boolean,
              short: "v",
              description: "Enable verbose output",
              default: true,
            },
          },
        })
        .parse(["test", "--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });
  });

  describe("implicit default values", () => {
    it("should show implicit default for Boolean flags (false)", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("test", "Test command", {
          flags: {
            verbose: {
              type: Boolean,
              description: "Enable verbose output",
            },
          },
        })
        .parse(["test", "--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should show implicit default for Boolean shorthand (false)", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("test", "Test command", {
          flags: {
            verbose: Boolean,
          },
        })
        .parse(["test", "--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should show implicit default for Counter [Boolean] flags (0)", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("test", "Test command", {
          flags: {
            verbosity: {
              type: [Boolean],
              description: "Verbosity level (can be specified multiple times)",
            },
          },
        })
        .parse(["test", "--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should show implicit default for Array flags ([])", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("test", "Test command", {
          flags: {
            file: {
              type: [String],
              description: "Files to process (can be specified multiple times)",
            },
          },
        })
        .parse(["test", "--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should show implicit default for Object flags ({})", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("test", "Test command", {
          flags: {
            config: {
              type: Object,
              description: "Configuration object",
            },
          },
        })
        .parse(["test", "--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should NOT show default for String/Number flags without explicit default", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("test", "Test command", {
          flags: {
            name: {
              type: String,
              description: "Name value",
            },
            count: {
              type: Number,
              description: "Count value",
            },
          },
        })
        .parse(["test", "--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should prefer explicit default over implicit default", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("test", "Test command", {
          flags: {
            verbose: {
              type: Boolean,
              description: "Enable verbose output",
              default: true,
            },
            files: {
              type: [String],
              description: "Files to process",
              default: ["default.txt"],
            },
          },
        })
        .parse(["test", "--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });
  });

  describe("alias", () => {
    it("should show single string alias", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("test", "Test command", {
          alias: "t",
        })
        .parse(["help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should show array of aliases", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("test", "Test command", {
          alias: ["t", "test-cmd"],
        })
        .parse(["help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should show root alias (empty string)", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("test", "Test command", {
          alias: "",
        })
        .parse(["help"]);

      await TestBaseCli()
        .use(helpPlugin())
        .command("test", "Test command", {
          alias: "",
        })
        .parse(["help", "test"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should show root alias (empty string in array)", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("test", "Test command", {
          alias: ["t", ""],
        })
        .parse(["help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should show alias for subcommands", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("parent child", "Child command", {
          alias: "c",
        })
        .parse(["parent", "--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });
  });

  describe("getter support", () => {
    it("should work with static header/footer/notes/examples", async () => {
      await TestBaseCli()
        .use(
          helpPlugin({
            header: "STATIC_HEADER",
            footer: "STATIC_FOOTER",
            notes: ["Static note"],
            examples: [["$ cli test", "Static example"]],
          }),
        )
        .parse(["--help"]);

      expect(getConsoleMock("log").mock.calls).toMatchSnapshot();
    });

    it("should resolve sync getter for header", async () => {
      await TestBaseCli()
        .use(helpPlugin({ header: () => "SYNC_HEADER" }))
        .parse(["--help"]);

      const output = getConsoleMock("log").mock.calls.flat().join("\n");

      expect(output).toContain("SYNC_HEADER");
    });

    it("should resolve async getter for header", async () => {
      await TestBaseCli()
        .use(helpPlugin({ header: async () => "ASYNC_HEADER" }))
        .parse(["--help"]);

      const output = getConsoleMock("log").mock.calls.flat().join("\n");

      expect(output).toContain("ASYNC_HEADER");
    });

    it("should resolve sync getter for footer", async () => {
      await TestBaseCli()
        .use(helpPlugin({ footer: () => "SYNC_FOOTER" }))
        .parse(["--help"]);

      const output = getConsoleMock("log").mock.calls.flat().join("\n");

      expect(output).toContain("SYNC_FOOTER");
    });

    it("should resolve async getter for footer", async () => {
      await TestBaseCli()
        .use(helpPlugin({ footer: async () => "ASYNC_FOOTER" }))
        .parse(["--help"]);

      const output = getConsoleMock("log").mock.calls.flat().join("\n");

      expect(output).toContain("ASYNC_FOOTER");
    });

    it("should resolve getter for plugin-level notes", async () => {
      await TestBaseCli()
        .use(helpPlugin({ notes: () => ["Dynamic plugin note"] }))
        .parse(["--help"]);

      const output = getConsoleMock("log").mock.calls.flat().join("\n");

      expect(output).toContain("Dynamic plugin note");
    });

    it("should resolve getter for plugin-level examples", async () => {
      await TestBaseCli()
        .use(
          helpPlugin({ examples: () => [["$ cli test", "Dynamic example"]] }),
        )
        .parse(["--help"]);

      const output = getConsoleMock("log").mock.calls.flat().join("\n");

      expect(output).toContain("Dynamic example");
    });

    it("should resolve getter for command-level notes", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("foo", "Foo command", {
          help: { notes: async () => ["Async command note"] },
        })
        .parse(["help", "foo"]);

      const output = getConsoleMock("log").mock.calls.flat().join("\n");

      expect(output).toContain("Async command note");
    });

    it("should resolve getter for command-level examples", async () => {
      await TestBaseCli()
        .use(helpPlugin())
        .command("foo", "Foo command", {
          help: {
            examples: async () => [["$ cli foo", "Async example"]],
          },
        })
        .parse(["help", "foo"]);

      const output = getConsoleMock("log").mock.calls.flat().join("\n");

      expect(output).toContain("Async example");
    });

    it("should resolve all getters together", async () => {
      await TestBaseCli()
        .use(
          helpPlugin({
            header: async () => "COMBINED_HEADER",
            footer: async () => "COMBINED_FOOTER",
            notes: () => ["Combined note"],
            examples: () => [["$ cli", "Combined example"]],
          }),
        )
        .parse(["--help"]);

      const output = getConsoleMock("log").mock.calls.flat().join("\n");

      expect(output).toContain("COMBINED_HEADER");
      expect(output).toContain("COMBINED_FOOTER");
      expect(output).toContain("Combined note");
      expect(output).toContain("Combined example");
    });

    it("should not log header when getter returns undefined", async () => {
      await TestBaseCli()
        .use(helpPlugin({ header: () => undefined }))
        .parse(["--help"]);

      const output = getConsoleMock("log").mock.calls.flat().join("\n");

      expect(output).not.toContain("undefined");
    });

    it("should not log header when getter returns void", async () => {
      await TestBaseCli()
        .use(helpPlugin({ header: () => {} }))
        .parse(["--help"]);

      const output = getConsoleMock("log").mock.calls.flat().join("\n");

      expect(output).not.toContain("undefined");
    });

    it("should not log footer when getter returns void", async () => {
      await TestBaseCli()
        .use(helpPlugin({ footer: () => {} }))
        .parse(["--help"]);

      const output = getConsoleMock("log").mock.calls.flat().join("\n");

      expect(output).not.toContain("undefined");
    });

    it("should not log footer when getter returns undefined", async () => {
      await TestBaseCli()
        .use(helpPlugin({ footer: async () => undefined }))
        .parse(["--help"]);

      const output = getConsoleMock("log").mock.calls.flat().join("\n");

      expect(output).not.toContain("undefined");
    });

    it("should let command-level notes override plugin-level notes", async () => {
      await TestBaseCli()
        .use(helpPlugin({ notes: () => ["Plugin note"] }))
        .command("foo", "Foo command", {
          help: { notes: () => ["Command note"] },
        })
        .parse(["help", "foo"]);

      const output = getConsoleMock("log").mock.calls.flat().join("\n");

      expect(output).toContain("Command note");
      expect(output).not.toContain("Plugin note");
    });
  });
});
