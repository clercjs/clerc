import { Clerc } from "@clerc/core";
import { Cli } from "clerc";
import { vi } from "vitest";

export const TestBaseCli = () =>
  Clerc.create().scriptName("test").description("test").version("0.0.0");

export const TestCli = () =>
  Cli().scriptName("test").description("test").version("0.0.0");

export const getConsoleMock = (method: keyof Console) =>
  vi.mocked(console[method])!;
