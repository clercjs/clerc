````mdc
---
title: Parameters
---

# Parameters

Parameters (also known as _positional arguments_) are names that correspond to argument values. Think of parameters as variable names and argument values as values associated with variables.

This guide covers parameter definitions, constraints, and descriptions.

## Basic Parameter Definition

You can define parameters in the `parameters` array property to access specific arguments by name. Parameters can be defined in the following formats:

- **Required parameters** are denoted by angle brackets (e.g., `<parameter name>`).
- **Optional parameters** are denoted by square brackets (e.g., `[parameter name]`).
- **Spread parameters** are denoted by the `...` suffix (e.g., `<parameter name...>` or `[parameter name...]`).

Note that required parameters **cannot come after optional parameters**, and spread parameters must be placed last.

Parameters can be accessed using camelCase notation on the `ctx.parameters` property.

Example:

```ts
// $ node ./foo-cli.mjs a b c d

const cli = Cli()
	.scriptName("foo-cli")
	.description("A simple CLI")
	.version("1.0.0")
	.command("foo", "A foo command", {
		parameters: [
			"<required parameter>",
			"[optional parameter]",
			"[optional spread...]",
		],
	})
	.on("foo", (ctx) => {
		ctx.parameters;
		//  ^?
		ctx.parameters.requiredParameter; // => "a"
		ctx.parameters.optionalParameter; // => "b"
		ctx.parameters.optionalSpread; // => ["c", "d"]
	})
	.parse();
```

## Parameter Objects

For more advanced parameter configuration, you can use parameter objects instead of simple strings. Parameter objects allow you to:

- Add a constraint to validate parameter values
- Add a description for documentation and help output

### Basic Parameter Object

```ts
const cli = Cli()
	.scriptName("config-cli")
	.description("Configuration tool")
	.version("1.0.0")
	.command("set", "Set a configuration value", {
		parameters: [
			{
				key: "<key>",
				description: "Configuration key name",
			},
			{
				key: "<value>",
				description: "Configuration value",
			},
		],
	})
	.on("set", (ctx) => {
		console.log(`Setting ${ctx.parameters.key} to ${ctx.parameters.value}`);
	})
	.parse();
```

## Parameter Constraints

Parameter constraints allow you to validate parameter values and provide valid options in help documentation.

### Using Constraint Functions

Clerc provides several built-in constraint factory functions:

#### Enum Constraint

Restrict parameter values to a predefined set of options:

```ts
import { Constraints } from "clerc";

const cli = Cli()
	.scriptName("build-cli")
	.description("Build tool")
	.version("1.0.0")
	.command("config", "Configure build settings", {
		parameters: [
			{
				key: "<setting>",
				constraint: Constraints.Enum("output", "target", "format"),
				description: "Setting name",
			},
			{
				key: "<value>",
				description: "Setting value",
			},
		],
	})
	.on("config", (ctx) => {
		console.log(`Setting ${ctx.parameters.setting} = ${ctx.parameters.value}`);
	})
	.parse();
```

Usage:

```bash
$ build-cli config output dist
$ build-cli config target es2020
$ build-cli config invalid value
# Error: Invalid value: invalid. Must be one of: output, target, format
```

#### Range Constraint

Restrict numeric parameter values to a specific range:

```ts
import { Constraints } from "clerc";

const cli = Cli()
	.scriptName("server-cli")
	.description("Server management tool")
	.version("1.0.0")
	.command("start", "Start the server", {
		parameters: [
			{
				key: "[port]",
				constraint: Constraints.Range(1024, 65535),
				description: "Port number",
			},
		],
	})
	.on("start", (ctx) => {
		const port = ctx.parameters.port || 3000;
		console.log(`Starting server on port ${port}`);
	})
	.parse();
```

Usage:

```bash
$ server-cli start 3000
$ server-cli start 8080
$ server-cli start 100
# Error: Invalid value: 100. Must be a number between 1024 and 65535
```

#### Regex Constraint

Validate parameter values against a regular expression pattern:

```ts
import { Constraints } from "clerc";

const cli = Cli()
	.scriptName("git-clone")
	.description("Clone repository")
	.version("1.0.0")
	.command("clone", "Clone a repository", {
		parameters: [
			{
				key: "<repo>",
				constraint: Constraints.Regex(/^[a-zA-Z0-9\-_.]+\/[a-zA-Z0-9\-_.]+$/, "owner/repo format"),
				description: "Repository in owner/repo format",
			},
		],
	})
	.on("clone", (ctx) => {
		console.log(`Cloning ${ctx.parameters.repo}`);
	})
	.parse();
```

#### Custom Constraint

Create custom validation logic:

```ts
import { Constraints } from "clerc";

const cli = Cli()
	.scriptName("app")
	.description("Application")
	.version("1.0.0")
	.command("upload", "Upload file", {
		parameters: [
			{
				key: "<file>",
				constraint: Constraints.Custom(
					(value) => /\.(jpg|png|gif)$/i.test(value),
					"image file (.jpg, .png, .gif)",
					(value) => `Invalid file: ${value}. Must be an image file.`
				),
				description: "Image file to upload",
			},
		],
	})
	.on("upload", (ctx) => {
		console.log(`Uploading ${ctx.parameters.file}`);
	})
	.parse();
```

## End-of-File

The end-of-file (`--`) (also known as _flag terminator_) allows users to pass a portion of arguments. This is useful for arguments that should be parsed separately from other arguments or arguments that look like flags.

An example is [`npm run`](https://docs.npmjs.com/cli/v8/commands/npm-run-script):

```sh
$ npm run <script> -- <script arguments>
```

The `--` indicates that all arguments after it should be passed to the _script_ rather than _npm_.

You can specify `--` in the `parameters` array to parse flag terminator arguments.

Example:

```ts
// $ node ./foo-cli.mjs echo -- hello world

const cli = Cli()
	.scriptName("foo-cli")
	.description("A simple CLI")
	.version("1.0.0")
	.command("echo", "Echo", {
		parameters: ["<script>", "--", "[arguments...]"],
	})
	.on("echo", (ctx) => {
		ctx.parameters;
		//  ^?
		ctx.parameters.script; // => "echo"
		ctx.parameters.arguments; // => ["hello", "world"]
	})
	.parse();
```

````
