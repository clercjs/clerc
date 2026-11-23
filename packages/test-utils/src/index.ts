import type {
  CreateCliOptions,
  MemoryTerminal,
  MemoryTerminalOptions,
} from "@clerc/core";
import { createCli, createMemoryTerminal } from "@clerc/core";
import { Cli } from "clerc";

export { createMemoryTerminal };
export type { MemoryTerminal, MemoryTerminalOptions };

export const createTestBaseCli = (options?: CreateCliOptions) =>
  createCli({
    scriptName: "test",
    description: "Test CLI",
    version: "1.0.0",
    help: false,
    ...options,
  });

export const createTestCli = (options?: CreateCliOptions) =>
  Cli({
    scriptName: "test",
    description: "Test CLI",
    version: "1.0.0",
    ...options,
  });
