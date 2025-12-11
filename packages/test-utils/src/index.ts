import { Clerc } from "@clerc/core";
import type { MockInstance } from "vitest";

export const TestCli = (instance: typeof Clerc = Clerc): Clerc =>
	instance.create().scriptName("test").description("test").version("0.0.0");

export const getConsoleMock = (method: keyof Console) =>
	console[method] as any as MockInstance;
