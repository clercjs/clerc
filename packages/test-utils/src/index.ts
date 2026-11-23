import type { MemoryTerminal, MemoryTerminalOptions } from "@clerc/core";
import { createCli, createMemoryTerminal } from "@clerc/core";
import { Cli } from "clerc";

export { createMemoryTerminal };
export type { MemoryTerminal, MemoryTerminalOptions };

export const createTestBaseCli = () =>
  createCli({
    scriptName: "test",
    description: "Test CLI",
    version: "1.0.0",
  });

export const createTestCli = () =>
  Cli({
    scriptName: "test",
    description: "Test CLI",
    version: "1.0.0",
  });
