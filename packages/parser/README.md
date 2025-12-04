# @clerc/parser

A powerful, lightweight, and flexible command-line arguments parser.

## Installation

```bash
npm install @clerc/parser
# or
yarn add @clerc/parser
# or
pnpm add @clerc/parser
```

## Usage

The core of this package is the `parse` function. It takes an array of arguments and a configuration object, and returns a structured object containing the parsed flags, parameters, and other useful information.

```typescript
import { parse } from "@clerc/parser";

const { flags, parameters, unknown } = parse(process.argv.slice(2), {
	flags: {
		// Define your flags here
		port: {
			type: Number,
			alias: "p",
			default: 8080,
		},
		help: {
			type: Boolean,
			alias: "h",
		},
	},
});

console.log("Flags:", flags);
console.log("Parameters:", parameters);
console.log("Unknown args:", unknown);
```

## API

### `parse(args, options)`

#### `args`

- Type: `string[]`
- The array of command-line arguments to parse (e.g., `process.argv.slice(2)`).

#### `options`

- Type: `ParseOptions`

An object to configure the parser.

- **`flags`**: An object defining the flags to parse.
  - Key: The name of the flag (in camelCase).
  - Value: The flag's configuration, which can be a type constructor (`String`, `Number`, `Boolean`) or a custom function that takes a string and returns a parsed value or an object with the following properties:
    - `type`: The type of the flag. Can be a constructor like `String`, `Number`, `Boolean`, `Object`, an array of a constructor (e.g., `[String]`), or a custom function that takes a string and returns a parsed value.
    - `alias`: A string or an array of strings for alternative names (e.g., short flags).
  - `default`: A default value for the flag if it's not provided in the arguments. Can be a value or a function that returns a value.
  - `negatable`: (For Booleans) Whether to support `--no-<flag>` syntax. Defaults to `true`.
- **`ignore`**: A function to conditionally stop parsing. It receives the `type` (`flag` or `parameter`) and the `arg` string, and should return `true` to stop parsing from that point.

#### Returns

An object with the following properties:

- `flags`: An object containing the parsed flags.
- `parameters`: An array of positional arguments.
- `unknown`: An object containing flags that were not defined in the schema.
- `doubleDash`: An array of arguments that appear after a `--`.
- `ignored`: An array of arguments that were ignored due to the `ignore` function.

## Features

### Basic Types

Supports `Boolean`, `String`, and `Number`.

```typescript
const { flags } = parse(["--bool", "--str", "hello", "--num", "42"], {
	flags: {
		bool: { type: Boolean },
		str: { type: String },
		num: { type: Number },
	},
});
// flags: { bool: true, str: "hello", num: 42 }
```

### Aliases

Use `alias` to define short or alternative names for flags.

```typescript
const { flags } = parse(["-b", "-s", "hello"], {
	flags: {
		bool: { type: Boolean, alias: "b" },
		str: { type: String, alias: "s" },
	},
});
// flags: { bool: true, str: "hello" }
```

### Arrays and Counters

- To collect multiple values for a flag, use an array type like `[String]`.
- To count the occurrences of a boolean flag, use `[Boolean]`.

```typescript
// Array of strings
const { flags: arrayFlags } = parse(["--arr", "a", "--arr", "b"], {
	flags: {
		arr: { type: [String] },
	},
});
// arrayFlags: { arr: ["a", "b"] }

// Counter
const { flags: counterFlags } = parse(["-vvv"], {
	flags: {
		verbose: { type: [Boolean], alias: "v" },
	},
});
// counterFlags: { verbose: 3 }
```

### Merged Short Flags

Multiple boolean short flags can be combined. The last flag in the group can take a value.

```typescript
// -abc => a=true, b=true, c=true
const { flags: merged } = parse(["-abc"], {
	flags: {
		a: Boolean,
		b: Boolean,
		c: Boolean,
	},
});
// merged: { a: true, b: true, c: true }

// -ab val => a=true, b="val"
const { flags: withValue } = parse(["-ab", "val"], {
	flags: {
		a: Boolean,
		b: String,
	},
});
// withValue: { a: true, b: "val" }
```

### Default Values

Provide a `default` value for flags that are not present.

```typescript
const { flags } = parse([], {
	flags: {
		str: { type: String, default: "default" },
		num: { type: Number, default: 123 },
		fn: { type: String, default: () => "computed" },
	},
});
// flags: { str: "default", num: 123, fn: "computed" }
```

By default, booleans, counters, arrays and objects have implicit defaults when `default` is not provided:

- Boolean: `false`
- Counter: `0`
- Array: `[]`
- Object: `{}`

### Negatable Flags

Boolean flags are negatable by default using the `--no-` prefix.

If you want to disable this behavior, set `negatable: false` in the flag configuration. Passing `--no-<flag>` will then be treated as an unknown flag.

```typescript
const { flags, unknown } = parse(
	["--no-cache", "--no-ssl=false", "--no-disable-negate"],
	{
		flags: {
			cache: { type: Boolean, default: true },
			ssl: { type: Boolean, default: true },
			disableNegate: { type: Boolean, negatable: false, default: true },
		},
	},
);
// flags: { cache: false, ssl: true, disableNegate: true }
// unknown: { noDisableNegate: true }
```

### Custom Type Functions

You can provide a custom function to the `type` property for advanced parsing logic. The function receives the string value and should return the parsed value.

```typescript
// Let's limit port between 1 and 65535
const { flags } = parse(["--port", "8080"], {
	flags: {
		port: {
			type: (value: string) => {
				const parsed = Number.parseInt(value, 10);
				if (Number.isNaN(parsed)) {
					throw new TypeError("Port must be a number!");
				}
				if (parsed < 1 || parsed > 65_535) {
					throw new Error("Port must be between 1 and 65535!");
				}

				return parsed;
			},
		},
	},
});
// flags: { port: 8080 }
```

### Dot-Nested Objects

Define flags with `Object` type to parse dot-notation arguments into a nested object.

```typescript
const { flags } = parse(
	["--config.port", "8080", "--config.host", "localhost"],
	{
		flags: {
			config: { type: Object },
		},
	},
);
// flags: { config: { port: "8080", host: "localhost" } }
```

Multi-level nesting is also supported.

```typescript
const { flags } = parse(
	[
		"--db.host",
		"localhost",
		"--db.port",
		"5432",
		"--db.credentials.user",
		"admin",
		"--db.credentials.password",
		"secret",
	],
	{
		flags: {
			db: { type: Object },
		},
	},
);
// flags: { db: { host: "localhost", port: "5432", credentials: { user: "admin", password: "secret" } } }
```

### Unknown Flags

Flags that are not defined in the schema are collected in the `unknown` object. If possible, they will be converted to boolean `true`.

```typescript
const { flags, unknown } = parse([
	"--unknown1",
	"--unknown2=foo",
	"--unknown3",
	"bar",
	"--unknown.foo",
]);

// unknown: { unknown1: true, unknown2: "foo", unknown3: "bar", "unknown.foo": true }
```

### Stop Parsing

Use the `ignore` function to stop parsing when a certain condition is met. Subsequent arguments will be added to the `ignored` array.

```typescript
const { flags, ignored } = parse(["--a", "--b", "stop", "--c"], {
	flags: {
		a: Boolean,
		b: Boolean,
		c: Boolean,
	},
	ignore: (type, arg) => arg === "stop",
});
// flags: { a: true, b: true, c: false }
// ignored: ["stop", "--c"]
```

You can ignore everything after the first positional parameter by checking the `type`.

```typescript
const { flags, parameters, ignored } = parse(
	["--allow-all", "./deno.ts", "--param"],
	{
		flags: {
			allowAll: Boolean,
		},
		ignore: (type) => type === "parameter",
	},
);

// flags: { allowAll: true }
// parameters: []
// ignored: ["./deno.ts", "--param"]
```

### Double Dash (`--`)

Arguments after `--` are not parsed as flags and are collected in the `doubleDash` array.

```typescript
const { flags, doubleDash } = parse(["--foo", "--", "--bar"], {
	flags: {
		foo: Boolean,
		bar: Boolean,
	},
});
// flags: { foo: true, bar: false }
// doubleDash: ["--bar"]
```
