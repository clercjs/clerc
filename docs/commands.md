---
title: Commands
---

# Commands

## Basic Usage

```ts
const cli = Cli()
	.scriptName("foo-cli")
	.description("A simple CLI")
	.version("1.0.0")
	.command("foo", "A foo command")
	.on("foo", (ctx) => {
		console.log("It works!");
	})
	.parse();
```

This creates a CLI application named `foo-cli` with a command called `foo`. When the user runs `foo-cli foo`, the CLI will output "It works!".

## Aliases

### Overview

Command aliases allow users to invoke a command using an alternative name. This is useful for providing shorter or more intuitive command names.

### Single Alias

You can define a single alias for a command using a string:

```ts
const cli = Cli()
	.scriptName("foo-cli")
	.description("A simple CLI")
	.version("1.0.0")
	.command("foo", "A foo command", {
		alias: "f",
	})
	.on("foo", (ctx) => {
		console.log("It works!");
	})
	.parse();
```

Now both `foo-cli foo` and `foo-cli f` will output "It works!".

### Multiple Aliases

You can define multiple aliases for a command using an array:

```ts
const cli = Cli()
	.scriptName("foo-cli")
	.description("A simple CLI")
	.version("1.0.0")
	.command("foo", "A foo command", {
		alias: ["f", "bar", "baz"],
	})
	.on("foo", (ctx) => {
		console.log("It works!");
	})
	.parse();
```

Now `foo-cli foo`, `foo-cli f`, `foo-cli bar`, and `foo-cli baz` all work the same way.

### Practical Examples

#### Example: Git-like Abbreviations

```ts
const cli = Cli()
	.scriptName("git")
	.command("status", "Show working tree status", {
		alias: "st",
	})
	.on("status", (ctx) => {
		console.log("On branch main...");
	})
	.command("commit", "Record changes to repository", {
		alias: ["ci", "com"],
	})
	.on("commit", (ctx) => {
		console.log("Committing changes...");
	})
	.command("checkout", "Switch branches or restore files", {
		alias: "co",
	})
	.on("checkout", (ctx) => {
		console.log("Checking out...");
	})
	.parse();
```

Usage:

```sh
$ git st
$ git commit
$ git ci
$ git com
$ git checkout
$ git co
```

## Subcommands

You can define subcommands by using spaces in the command name:

```ts
const cli = Cli()
	.scriptName("foo-cli")
	.description("A simple CLI")
	.version("1.0.0")
	.command("parent child", "A subcommand")
	.on("parent child", (ctx) => {
		console.log("Subcommand was called!");
	})
	.parse();
```

## Root Command

You can define a root command (a command with no name) to handle cases when no subcommand is specified:

```ts
const cli = Cli()
	.scriptName("foo-cli")
	.description("A simple CLI")
	.version("1.0.0")
	.command("", "Root command")
	.on("", (ctx) => {
		console.log("Root command was called!");
	})
	.parse();
```

## Parameters

### General

Parameters (also known as _positional arguments_) are names that correspond to argument values. Think of parameters as variable names and argument values as values associated with variables.

You can define parameters in the `parameters` array property to access specific arguments by name. This is useful for writing more readable code, enforcing validation, and generating help documentation.

Parameters can be defined in the following formats:

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

### End-of-file

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

## Flags

Please refer to the [Flags Documentation](./flags).

## Ignore

Sometimes, you may want to ignore certain arguments or flags in the command line input. For example, this usage of `deno`:

```sh
deno run --allow-read script.ts --flag
```

Where `--flag` is passed directly to the script, not to `deno`.

You can achieve this usage by using the `ignore` property to specify which arguments or flags to ignore.

```ts
import { PARAMETER } from "clerc";

let encounteredParameter = false;

const cli = Cli()
	.scriptName("deno")
	.description("Deno CLI")
	.version("1.0.0")
	.command("run", "Run script", {
		flags: {
			allowRead: {
				type: Boolean,
				description: "Allow file system read",
			},
		},
		parameters: ["<script>", "[args...]"],
		ignore: (type) => {
			if (type === PARAMETER && !encounteredParameter) {
				encounteredParameter = true;

				return false; // Don't ignore the first parameter (script name)
			}

			// Ignore the rest of the parameters
			return encounteredParameter;
		},
	})
	.on("run", (ctx) => {
		// Handle script execution
		ctx.ignored; // => ["--flag"]
		//	^?
	})
	.parse();
```

## Advanced Usage

To separate the handler from the cli definition, you can use the `defineCommand` utility function:

```ts
import { defineCommand } from "clerc";

const command = defineCommand({
	name: "test",
	description: "Test",
	flags: {},
	parameters: [],
	handler: (ctx) => {
		// Handler
	},
});

const cli = Cli()
	.scriptName("foo-cli")
	.description("A simple CLI")
	.version("1.0.0")
	.command(command)
	.parse();
```

## Lazy Loading

Lazy loading allows you to defer the loading of command handlers until they are actually invoked. This is useful for reducing startup time and memory usage, especially when you have many commands or heavy handlers.

You can implement lazy loading by using dynamic imports (`await import()`) within the handler:

### Basic Lazy Loading

```ts
const cli = Cli()
	.scriptName("app")
	.description("An application with lazy loading")
	.version("1.0.0")
	.command("build", "Build the project", {
		flags: {
			production: {
				type: Boolean,
				description: "Build for production",
			},
		},
	})
	.on("build", async (ctx) => {
		// Handler is only loaded when the command is invoked
		const { buildProject } = await import("./handlers/build.js");
		await buildProject(ctx);
	})
	.command("deploy", "Deploy the application", {
		flags: {
			environment: {
				type: String,
				default: "staging",
				description: "Target environment",
			},
		},
	})
	.on("deploy", async (ctx) => {
		// Another handler loaded lazily
		const { deploy } = await import("./handlers/deploy.js");
		await deploy(ctx);
	})
	.parse();
```

### Lazy Loading with defineCommand

You can also combine lazy loading with the `defineCommand` utility:

```ts
import { defineCommand } from "clerc";

const command = defineCommand({
	name: "migrate",
	description: "Run database migrations",
	flags: {},
	parameters: [],
	handler: async (ctx) => {
		// Handler loaded only when command is invoked
		const { runMigrations } = await import("./handlers/migrate.js");
		await runMigrations(ctx);
	},
});

const cli = Cli()
	.scriptName("app")
	.description("Application with lazy-loaded commands")
	.version("1.0.0")
	.command(command)
	.parse();
```

### Benefits

- **Faster startup time**: Only handlers for invoked commands are loaded
- **Lower memory usage**: Unused handlers don't consume memory
- **Better scalability**: Easy to add many commands without performance impact
- **Asynchronous operations**: Handlers can perform async operations like file I/O or network requests

### Example: Modular Command Structure

Directory structure:

```
project/
├── cli.ts
├── handlers/
│   ├── build.ts
│   ├── dev.ts
│   ├── deploy.ts
│   └── test.ts
```

`handlers/build.ts`:

```ts
export async function buildProject(ctx) {
	if (ctx.flags.production) {
		console.log("Building for production...");
	} else {
		console.log("Building for development...");
	}
}
```

`cli.ts`:

```ts
const cli = Cli()
	.scriptName("app")
	.version("1.0.0")
	.command("build", "Build the project", {
		flags: {
			production: {
				type: Boolean,
				description: "Build for production",
			},
		},
	})
	.on("build", async (ctx) => {
		const { buildProject } = await import("./handlers/build.js");
		await buildProject(ctx);
	})
	.command("dev", "Start development server", {})
	.on("dev", async (ctx) => {
		const { startDev } = await import("./handlers/dev.js");
		await startDev(ctx);
	})
	.command("deploy", "Deploy application")
	.on("deploy", async (ctx) => {
		const { deploy } = await import("./handlers/deploy.js");
		await deploy(ctx);
	})
	.parse();
```
