import type {
  CreateCliOptions,
  MemoryTerminal,
  MemoryTerminalOptions,
} from "clerc";
import { Cli, createMemoryTerminal } from "clerc";

export { createMemoryTerminal };
export type { MemoryTerminal, MemoryTerminalOptions };

export const createTestBaseCli = (options?: Partial<CreateCliOptions>) =>
  Cli({
    scriptName: "test",
    description: "Test CLI",
    version: "1.0.0",
    help: false,
    ...options,
  });

export const createTestCli = (options?: Partial<CreateCliOptions>) =>
  Cli({
    scriptName: "test",
    description: "Test CLI",
    version: "1.0.0",
    ...options,
  });
