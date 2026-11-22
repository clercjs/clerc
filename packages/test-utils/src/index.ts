import { Clerc } from "@clerc/core";
import { Cli } from "clerc";
import type { Mock } from "vitest";
import { vi } from "vitest";

export const TestBaseCli = (): Clerc =>
  Clerc.create().scriptName("test").description("test").version("0.0.0");

export const TestCli = (): Clerc =>
  Cli().scriptName("test").description("test").version("0.0.0");

export const getConsoleMock = (method: keyof Console): Mock =>
  vi.mocked(console[method]) as Mock;
