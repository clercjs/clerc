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

The flag description object can be used to store additional information about the flag, such as `alias`, `default`, and `description`. To accept multiple values for a flag, wrap the type function in an array.

All provided information will be used to generate better help documentation.

## Flag Aliases

Flag aliases allow users to use shorter or alternative names for flags. This is useful for providing convenient shortcuts for commonly used flags.

### Single Alias

You can define a single alias for a flag using a string:

```ts
const cli = Cli()
	.command("build", "Build the project", {
		flags: {
			output: {
				type: String,
				alias: "o",
				description: "Output directory",
			},

			verbose: {
				type: Boolean,
				alias: "v",
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

### Multiple Aliases

You can define multiple aliases for a flag using an array:

```ts
const cli = Cli()
	.command("config", "Configure the application", {
		flags: {
			config: {
				type: String,
				alias: ["c", "cfg"],
				description: "Configuration file path",
			},

			format: {
				type: String,
				alias: ["f", "fmt"],
				description: "Output format",
			},
		},
	})
	.on("config", (ctx) => {
		// All of these work:
		// $ node cli.mjs config --config file.json
		// $ node cli.mjs config -c file.json
		// $ node cli.mjs config -cfg file.json
		// $ node cli.mjs config --format json
		// $ node cli.mjs config -f json
		// $ node cli.mjs config -fmt json
	})
	.parse();
```

### Combined Short Aliases

When using short aliases (single characters), they can be combined together:

```ts
const cli = Cli()
	.command("compress", "Compress files", {
		flags: {
			output: {
				type: String,
				alias: "o",
				description: "Output file",
			},

			verbose: {
				type: Boolean,
				alias: "v",
				description: "Verbose output",
			},

			recursive: {
				type: Boolean,
				alias: "r",
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
				alias: "n",
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

## Flag Types Explained

### String Type

The `String` type is used for flags that accept string values. This is the most basic flag type.

**Default value behavior:** If the flag is not specified, its value is `undefined` (unless a `default` property is set).

```ts
const cli = Cli()
	.command("greet", "Greet someone", {
		flags: {
			name: {
				type: String,
				description: "User name",
				default: "World",
			},

			message: {
				type: String,
				alias: "m",
				description: "Greeting message",
			},
		},
	})
	.on("greet", (ctx) => {
		console.log(`${ctx.flags.message}, ${ctx.flags.name}!`);
		// $ node cli.mjs greet --name John --message Hello
		// Hello, John!
		// $ node cli.mjs greet --message Hello
		// ctx.flags.message => "Hello"
		// ctx.flags.name => "World" (uses default value)
	})
	.parse();
```

### Boolean Type

The `Boolean` type is used for creating boolean switch flags. By default, simply mentioning the flag name sets it to `true`.

**Default value behavior:** If the flag is not specified, its value is `false`.

```ts
const cli = Cli()
	.command("build", "Build the project", {
		flags: {
			production: {
				type: Boolean,
				description: "Build for production",
			},

			watch: {
				type: Boolean,
				alias: "w",
				description: "Enable watch mode",
			},
		},
	})
	.on("build", (ctx) => {
		// $ node cli.mjs build --production --watch
		ctx.flags.production; // => true
		ctx.flags.watch; // => true

		// $ node cli.mjs build
		ctx.flags.production; // => false
		ctx.flags.watch; // => false
	})
	.parse();
```

#### Boolean's Negatable Property

The Boolean type supports a `negatable` property that allows you to decide whether to enable negated flags. By default, `negatable` is `true`, which means `--no-flag` will set the `flag` flag to `false`.

```ts
const cli = Cli()
	.command("start", "Start the application", {
		flags: {
			color: {
				type: Boolean,
				negatable: true, // default
				description: "Enable color output",
				default: true,
			},

			cache: {
				type: Boolean,
				negatable: false, // disable negation form
				description: "Enable caching",
				default: true,
			},
		},
	})
	.on("start", (ctx) => {
		// $ node cli.mjs start
		ctx.flags.color; // => true
		ctx.flags.cache; // => true

		// $ node cli.mjs start --no-color --no-cache
		ctx.flags.color; // => false
		ctx.flags.cache; // => true

		// You must use --cache=false to disable caching
		// $ node cli.mjs start --cache=false
		ctx.flags.cache; // => false
	})
	.parse();
```

### Array Type

The `Array` type is used for flags that accept multiple values. Define it by wrapping the type function in an array:

**Default value behavior:** If the flag is not specified, its value is `[]` (empty array).

```ts
const cli = Cli()
	.command("copy", "Copy files", {
		flags: {
			// Use [String] to accept multiple string values
			include: {
				type: [String],
				alias: "i",
				description: "File patterns to include",
			},

			// Use [Number] to accept multiple numeric values
			ports: {
				type: [Number],
				alias: "p",
				description: "Ports to listen on",
			},
		},
	})
	.on("copy", (ctx) => {
		// $ node cli.mjs copy -i "*.js" -i "*.ts" -p 3000 -p 3001
		ctx.flags.include; // => ["*.js", "*.ts"]
		ctx.flags.ports; // => [3000, 3001]

		// $ node cli.mjs copy
		ctx.flags.include; // => []
		ctx.flags.ports; // => []
	})
	.parse();
```

:::info

If you want to pass key-value pairs like `K=V`, you can use the colon delimiter in the command line:

```bash
$ node cli.mjs config --define:env=production --define:version=1.0.0
```

Actually, `--define=env=production` also works fine, it's just not as intuitive.

:::

### Counter Type

The counter type is used to count how many times a flag is specified. This can be implemented by using the `[Boolean]` type:

**Default value behavior:** If the flag is not specified, its value is `0`.

```ts
const cli = Cli()
	.command("log", "Display logs", {
		flags: {
			// [Boolean] type counts how many times the flag is used
			verbose: {
				type: [Boolean],
				alias: "v",
				description: "Verbosity level (-v, -vv, -vvv)",
			},
		},
	})
	.on("log", (ctx) => {
		// $ node cli.mjs log -v
		ctx.flags.verbose; // => 1

		// $ node cli.mjs log -vvv
		ctx.flags.verbose; // => 3

		// $ node cli.mjs log -v -v -v
		ctx.flags.verbose; // => 3

		// $ node cli.mjs log
		ctx.flags.verbose; // => 0
	})
	.parse();
```

### Object Type

The `Object` type is used for flags that accept key-value pairs. Use dots or other delimiters to specify object properties:

**Default value behavior:** If the flag is not specified, its value is `{}` (empty object).

```ts
const cli = Cli()
	.command("config", "Configure the application", {
		flags: {
			define: {
				type: Object,
				alias: "d",
				description: "Define environment variables",
			},
		},
	})
	.on("config", (ctx) => {
		// $ node cli.mjs config --define.apiUrl http://api.example.com --define.debug
		ctx.flags.define; // => { apiUrl: "http://api.example.com", debug: true }

		// $ node cli.mjs config
		ctx.flags.define; // => {}
	})
	.parse();
```

## Built-in Advanced Types

Clerc provides some built-in advanced flag types to facilitate common needs:

- `Enum`: Restrict flag values to a predefined set.

```ts
import { Enum } from "clerc";

Cli()
	.command("serve", "Start the server", {
		flags: {
			mode: {
				type: Enum("development", "production", "test"),
				default: "development" as const,
				description: "Set the application mode",
			},
		},
	})
	.on("serve", (ctx) => {
		ctx.flags.mode;
		//        ^?
	})
	.parse();
```

## Custom Flag Types

You can create custom flag types by providing a custom type function. The type function accepts a string argument and returns the parsed value.

```ts
// Custom type function that parses a comma-separated string into an array of strings
const CommaSeparatedList = (value: string): string[] =>
	value.split(",").map((item) => item.trim());

const cli = Cli()
	.scriptName("custom-cli")
	.description("A CLI using a custom flag type")
	.version("1.0.0")
	.command("list", "Display list", {
		flags: {
			items: {
				type: CommaSeparatedList,
				default: [] as string[],
				description: "Comma-separated list of strings",
			},
		},
	})
	.on("list", (ctx) => {
		console.log("Items:", ctx.flags.items);
		//                              ^?
	})
	.parse();
```
