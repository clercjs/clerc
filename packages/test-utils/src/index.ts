import type { MemoryTerminal, MemoryTerminalOptions } from "@clerc/core";
import { Clerc, createMemoryTerminal } from "@clerc/core";
import { Cli } from "clerc";

export { createMemoryTerminal };
export type { MemoryTerminal, MemoryTerminalOptions };

export const createTestBaseCli = (): Clerc =>
  Clerc.create({
    scriptName: "test",
    description: "Test CLI",
    version: "1.0.0",
  });

export const createTestCli = (): ReturnType<typeof Cli> =>
  Cli({
    scriptName: "test",
    description: "Test CLI",
    version: "1.0.0",
  });
