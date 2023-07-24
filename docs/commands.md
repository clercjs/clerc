# Command

> Most content of this page is adapted from [Cleye](https://github.com/privatenumber/cleye). Thanks!

## Options

We created a command called "foo" and its description is "foo command" in [Getting Started](./getting-started.md). And we use `on()` to register a command handler. Now we are going to learn how to add options to the command.

Options are passed as the third argument in `command(name, description, options?)`.

### Aliases

You can add an alias for your command:

```js
import { Clerc } from "clerc";

const cli = Clerc.create()
	.scriptName("foo-cli")
	.description("A simple cli")
	.version("1.0.0")
	.command("foo", "A foo command", {
		alias: "bar",
	})
	.on("foo", (context) => {
		console.log("It works!");
	})
	.parse();
```

Now both `foo-cli foo` and `foo-cli bar` will log "It works!".

You can add more aliases:

```js
import { Clerc } from "clerc";

const cli = Clerc.create()
	.scriptName("foo-cli")
	.description("A simple cli")
	.version("1.0.0")
	.command("foo", "A foo command", {
		alias: ["bar", "baz"],
	})
	.on("foo", (context) => {
		console.log("It works!");
	})
	.parse();
```

### Parameters

#### Common

Parameters (aka _positional arguments_) are the names that map against argument values. Think of parameters as variable names and arguments as values associated with the variables.

Parameters can be defined in the `parameters` array-property to make specific arguments accessible by name. This is useful for writing more readable code, enforcing validation, and generating help documentation.

Parameters are defined in the following formats:

- **Required parameters** are indicated by angle brackets (eg. `<parameter name>`).
- **Optional parameters** are indicated by square brackets (eg. `[parameter name]`).
- **Spread parameters** are indicated by `...` suffix (eg. `<parameter name...>` or `[parameter name...]`).

Note, required parameters cannot come after optional parameters, and spread parameters must be last.

Parameters can be accessed in camelCase on the `ctx.parameters` property.

Example:

```ts
// $ node ./foo-cli.mjs a b c d
import { Clerc } from "clerc";

const cli = Clerc.create()
	.scriptName("foo-cli")
	.description("A simple cli")
	.version("1.0.0")
	.command("foo", "A foo command", {
		parameters: [
			"<required parameter>",
			"[optional parameter]",
			"[optional spread...]",
		],
	})
	.on("foo", (context) => {
		context.parameters.requiredParameter; // => "a" (string)
		context.parameters.optionalParameter; // => "b" (string | undefined)
		context.parameters.optionalSpread; // => ["c", "d"] (string[])
	})
	.parse();
```

#### End-of-flags

End-of-flags (`--`) (aka _end-of-options_) allows users to pass in a subset of arguments. This is useful for passing in arguments that should be parsed separately from the rest of the arguments or passing in arguments that look like flags.

An example of this is [`npm run`](https://docs.npmjs.com/cli/v8/commands/npm-run-script):

```bash
$ npm run <script> -- <script arguments>
```

The `--` indicates that all arguments afterwards should be passed into the _script_ rather than _npm_.

You can specify `--` in the `parameters` array to parse end-of-flags arguments.

Example:

```ts
// $ node ./foo-cli.mjs echo -- hello world
import { Clerc } from "clerc";

const cli = Clerc.create()
	.scriptName("foo-cli")
	.description("A simple cli")
	.version("1.0.0")
	.command("echo", "Echo", {
		parameters: ["<script>", "--", "[arguments...]"],
	})
	.on("echo", (context) => {
		context.parameters.script; // => "echo" (string)
		context.parameters.arguments; // => ["hello", "world] (string[])
	})
	.parse();
```

### Flags

_Clerc_'s flag parsing is powered by [`type-flag`](https://github.com/privatenumber/type-flag) and comes with many features:

- Array & Custom types
- Flag delimiters: `--flag value`, `--flag=value`, `--flag:value`, and `--flag.value`
- Combined aliases: `-abcd 2` → `-a -b -c -d 2`
- [End of flags](https://unix.stackexchange.com/a/11382): Pass in `--` to end flag parsing
- Unknown flags: Unexpected flags stored in `unknownFlags`

Read the [_type-flag_ docs](https://github.com/privatenumber/type-flag) to learn more.

Flags can be specified in the `flags` object-property, where the key is the flag name, and the value is a flag type function or an object that describes the flag.

The flag name is recommended to be in camelCase as it will be interpreted to parse kebab-case equivalents.

The flag type function can be any function that accepts a string and returns the parsed value. Default JavaScript constructors should cover most use-cases: [String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/String), [Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/Number), [Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean/Boolean), etc.

The flag description object can be used to store additional information about the flag, such as `alias`, `default`, and `description`. To accept multiple values for a flag, wrap the type function in an array.

All of the provided information will be used to generate better help documentation.

Example:

```ts
// $ node ./foo-cli.mjs echo --some-boolean --some-string hello --some-number 1 -n 2
import { Clerc } from "clerc";

const cli = Clerc.create()
	.scriptName("foo-cli")
	.description("A simple cli")
	.version("1.0.0")
	.command("echo", "echo", {
		flags: {
			someBoolean: {
				type: Boolean,
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
				description: "Array of numbers. (eg. -n 1 -n 2 -n 3)",
			},
		},
	})
	.on("echo", (context) => {
		context.flags.someBoolean; // => true (boolean | undefined)
		context.flags.someString; // => "hello" (string)
		context.flags.someNumber; // => [1, 2] (number[])
	})
	.parse();
```

## Advanced Usage

To seperate handlers from the cli definition, you can use the `defineCommand` utility function.

```ts
import { Clerc, defineCommand } from "clerc";

const command = defineCommand(
	{
		name: "test",
		description: "test",
		flags: {},
		parameters: [],
	},
	(context) => {
		// handler
	},
);

const cli = Clerc.create()
	.scriptName("foo-cli")
	.description("A simple cli")
	.version("1.0.0")
	.command(command)
	.parse();
```
