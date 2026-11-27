import type {
  Cli,
  CliOptions,
  CliWithDefaultOptions,
  FlagsInput,
  MemoryTerminal,
  MemoryTerminalOptions,
  Middleware,
} from "clerc";
import { cli, createMemoryTerminal } from "clerc";

export { createMemoryTerminal };
export type { MemoryTerminal, MemoryTerminalOptions };

export function createTestBaseCli<
  const Use extends readonly Middleware<any, any>[] = readonly [],
  const F extends FlagsInput = {},
>(options: CliWithDefaultOptions<Use, F>): Cli;
export function createTestBaseCli<
  const Use extends readonly Middleware<any, any>[] = readonly [],
  const F extends FlagsInput = {},
>(options?: CliOptions<Use, F>): Cli;
export function createTestBaseCli(options?: Record<string, any>): Cli {
  return cli({
    name: "test",
    description: "Test CLI",
    version: "1.0.0",
    help: false,
    verbosity: false,
    ...options,
  });
}

export function createTestCli<
  const Use extends readonly Middleware<any, any>[] = readonly [],
  const F extends FlagsInput = {},
>(options: CliWithDefaultOptions<Use, F>): Cli;
export function createTestCli<
  const Use extends readonly Middleware<any, any>[] = readonly [],
  const F extends FlagsInput = {},
>(options?: CliOptions<Use, F>): Cli;
export function createTestCli(options?: Record<string, any>): Cli {
  return cli({
    name: "test",
    description: "Test CLI",
    version: "1.0.0",
    ...options,
  });
}
