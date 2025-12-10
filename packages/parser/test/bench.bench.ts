import { parseArgs } from "node:util";

import minimist from "minimist";
import mri from "mri";
import nopt from "nopt";
import { typeFlag } from "type-flag";
import { bench, describe } from "vitest";
import yargs from "yargs-parser";

import { parse } from "../src";

const args = ["--bool", "--no-meep", "--multi=baz"];

describe("bench", () => {
	bench("minimist", () => {
		minimist(args, {
			boolean: ["bool", "meep"],
			string: ["multi"],
		});
	});

	bench("mri", () => {
		mri(args);
	});

	bench("yargs-parser", () => {
		yargs(args);
	});

	bench("nopt", () => {
		nopt(
			{
				bool: Boolean,
				noMeep: Boolean,
				multi: String,
			},
			{},
			args,
		);
	});

	bench("type-flag", () => {
		typeFlag(
			{
				bool: Boolean,
				noMeep: Boolean,
				multi: String,
			},
			args,
		);
	});

	bench("node:util parseArgs", () => {
		parseArgs({
			args,
			allowNegative: true,
			options: {
				bool: {
					type: "boolean",
				},
				meep: {
					type: "boolean",
				},
				multi: {
					type: "string",
				},
			},
		});
	});

	bench("@clerc/parser", () => {
		parse(args, {
			flags: {
				bool: Boolean,
				meep: Boolean,
				multi: String,
			},
		});
	});
});
