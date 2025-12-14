---
title: flags
---

# Flags

Flags are used to provide additional configuration and parameters for commands. Clerc supports various types of options, including built-in JavaScript types such as Boolean, String, Number, and also custom types.

_Clerc_'s flag parsing is powered by [`@clerc/parser`](https://github.com/clercjs/clerc/blob/main/packages/parser) and has many features:

- Array and custom types
- Flag delimiters: `--flag value`, `--flag=value`, `--flag:value` and `--flag.value`
- Combined aliases: `-abcd 2` → `-a -b -c -d 2`
- [End-of-file](https://unix.stackexchange.com/a/11382): pass `--` to end parsing

Flags can be specified in the `flags` object property, where the key is the flag name and the value is either an flag type function or an object describing the flag.

It's recommended to use camelCase for flag names as it will be interpreted as parsing the equivalent kebab-case flag.

The flag type function can be any function that accepts a string and returns the parsed value. The default JavaScript constructors should cover most use cases: [String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/String), [Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/Number), [Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean/Boolean), etc.

The flag description object can be used to store additional information about the flag, such as `short`, `default`, and `description`. To accept multiple values for a flag, wrap the type function in an array.

All provided information will be used to generate better help documentation.

## Flag Short Names

Flag short names allow users to use single-character shortcuts for flags. This is useful for providing convenient shortcuts for commonly used flags.

### Defining Short Names

You can define a single-character short name for a flag using the `short` property:

```ts
const cli = Cli()
	.command("build", "Build the project", {
		flags: {
			output: {
				type: String,
				short: "o",
				description: "Output directory",
			},

			verbose: {
				type: Boolean,
				short: "v",
				description: "Enable verbose output",
			},
		},
	})
	.on("build", (ctx) => {
		// $ node cli.mjs build --output dist
		// $ node cli.mjs build -o dist
		// Both work the same way
		// $ node cli.mjs build --verbose
		// $ node cli.mjs build -v
		// Both enable verbose output
	})
	.parse();
```

### Validation Rules

- Flag names must be at least 2 characters long
- The `short` property must be exactly 1 character

### Combined Short Names

When using short names (single characters), they can be combined together:

```ts
const cli = Cli()
	.command("compress", "Compress files", {
		flags: {
			output: {
				type: String,
				short: "o",
				description: "Output file",
			},

			verbose: {
				type: Boolean,
				short: "v",
				description: "Verbose output",
			},

			recursive: {
				type: Boolean,
				short: "r",
				description: "Recursive mode",
			},
		},
	})
	.on("compress", (ctx) => {
		// $ node cli.mjs compress -vrh input.zip
		// Is equivalent to:
		// $ node cli.mjs compress -v -r -h input.zip
		// Which sets: verbose = true, recursive = true, and passes "input.zip" as a parameter
	})
	.parse();
```

## Basic Usage

```ts
// $ node ./foo-cli.mjs echo --some-boolean --some-string hello --some-number 1 -n 2

const cli = Cli()
	.scriptName("foo-cli")
	.description("A simple CLI")
	.version("1.0.0")
	.command("echo", "Echo", {
		flags: {
			someBoolean: {
				type: Boolean,
				description: "Some boolean flag",
			},

			someString: {
				type: String,
				description: "Some string flag",
				default: "n/a",
			},

			someNumber: {
				// Wrap the type function in an array to allow multiple values
				type: [Number],
				short: "n",
				description: "Array of numbers. (e.g. -n 1 -n 2 -n 3)",
			},

			object: {
				type: Object,
				description: "An object flag. (e.g. --object.key value)",
			},

			counter: {
				type: [Boolean],
				description: "A counter flag. (e.g. -c -c -c)",
			},
		},
	})
	.on("echo", (ctx) => {
		ctx.flags;
		//	^?
		ctx.flags.someBoolean; // => true
		ctx.flags.someString; // => "hello"
		ctx.flags.someNumber; // => [1, 2]
		ctx.flags.object; // => { key: "value" }
		ctx.flags.counter; // => 2
	})
	.parse();
```

## Flag Description

The `description` property is optional and can be omitted if you don't need to document the flag:

```ts
const cli = Cli()
	.command("build", "Build the project", {
		flags: {
			verbose: {
				type: Boolean,
				// description is optional
			},

			output: {
				type: String,
				description: "Output directory", // or include it for better documentation
			},
		},
	})
	.parse();
```

## Flag Types

For detailed information about flag types, including built-in basic types (String, Boolean, Array, Counter, Object) and advanced types (Enum, Range, Regex), as well as custom type definitions, see the [Types](./types) guide.
