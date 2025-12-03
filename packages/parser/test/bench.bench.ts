import minimist from "minimist";
import mri from "mri";
import { bench, describe } from "vitest";
import yargs from "yargs-parser";

import { parse } from "../src";

const args = ["-b", "--bool", "--no-meep", "--multi=baz"];

describe("sort", () => {
	bench("minimist", () => {
		minimist(args);
	});

	bench("mri", () => {
		mri(args);
	});

	bench("yargs-parser", () => {
		yargs(args);
	});

	bench("@clerc/parser", () => {
		parse(args);
	});
});
