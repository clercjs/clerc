import type {
  ClercOptions,
  MemoryTerminal,
  MemoryTerminalOptions,
} from "clerc";
import { clerc, createMemoryTerminal } from "clerc";

export { createMemoryTerminal };
export type { MemoryTerminal, MemoryTerminalOptions };

export const createTestBaseCli = (options?: Partial<ClercOptions>) =>
  clerc({
    scriptName: "test",
    description: "Test CLI",
    version: "1.0.0",
    help: false,
    ...options,
  });

export const createTestCli = (options?: Partial<ClercOptions>) =>
  clerc({
    scriptName: "test",
    description: "Test CLI",
    version: "1.0.0",
    ...options,
  });
