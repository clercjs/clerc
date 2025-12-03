import { parseArgs } from "node:util";

import minimist from "minimist";
import mri from "mri";
import nopt from "nopt";
import { typeFlag } from "type-flag";
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

	bench("nopt", () => {
		nopt(args);
	});

	bench("type-flag", () => {
		typeFlag({}, args);
	});

	bench("node:util parseArgs", () => {
		parseArgs({ args });
	});

	bench("@clerc/parser", () => {
		parse(args);
	});
});
