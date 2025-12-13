---
title: Help Plugin
---

# @clerc/plugin-help

A plugin that adds help information to your CLI.

:::info

This plugin is built into the `Clerc` class exported by the `clerc` package, so you don't need to install it separately to use it.

:::

## Standalone Usage

### 📦 Installation

:::code-group

```sh [npm]
$ npm install @clerc/plugin-help
```

```sh [yarn]
$ yarn add @clerc/plugin-help
```

```sh [pnpm]
$ pnpm add @clerc/plugin-help
```

:::

### 🚀 Usage

#### Import

```ts
import { helpPlugin } from "@clerc/plugin-help";
// or import directly from clerc
import { helpPlugin } from "clerc";
```

#### Basic Usage

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("My CLI application")
	.version("1.0.0")
	.use(helpPlugin()) // Add help plugin
	.command("hello", "Greeting command")
	.on("hello", (ctx) => {
		console.log("Hello, World!");
	})
	.parse();
```

## Running Effect

```bash
# Show main help, displays root command help when there is a root command, otherwise shows CLI's own help
$ node my-cli --help
# Show CLI's own help
$ node my-cli help

# Show help for a specific command
$ node my-cli hello --help
$ node my-cli help hello
```

## 📝 Features

### Auto-generate Help

The plugin automatically generates beautiful help information for your CLI, including:

- CLI name, version information, and description
- List of available commands
- List of command parameters
- Command options
- Global options
- Custom notes and examples

## Advanced Usage

### Command and Flag Groups

The help plugin supports organizing commands and flags into logical groups using the `groups` option. This makes your help output more organized and easier to navigate.

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("My CLI application")
	.version("1.0.0")
	.use(helpPlugin({
		groups: {
			commands: [
				["dev", "Development Commands"],
				["build", "Build Commands"],
				["test", "Testing Commands"],
			],
			flags: [
				["input", "Input Options"],
				["output", "Output Options"],
				["config", "Configuration Options"],
			],
			globalFlags: [
				["help", "Help Options"],
				["version", "Version Options"],
			],
		},
	}))
	.command("dev", "Start development server", {
		help: {
			group: "dev", // Assign to "dev" group
		},
	})
	.command("build", "Build the application", {
		help: {
			group: "build", // Assign to "build" group
		},
	})
	.command("test", "Run tests", {
		help: {
			group: "test", // Assign to "test" group
		},
	})
	.parse();
```

### Custom Command Help

You can set the `help` option to customize the help information for each command:

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("My CLI application")
	.version("1.0.0")
	.use(helpPlugin())
	.command("deploy", "Deploy command", {
		help: {
			showInHelp: true, // Show this command in help
			notes: [
				"This is a command for deploying applications.",
				"You can use different options to control deployment behavior.",
			],
			examples: [
				["my-cli deploy --env production", "Deploy to production environment"],
				[
					"my-cli deploy --env staging --force",
					"Deploy to staging environment and force execution",
				],
			],
		},
	})
	.parse();
```

### Plugin Options

You can customize the behavior of the help plugin by passing options:

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("My CLI application")
	.version("1.0.0")
	.use(
		helpPlugin({
			command: true, // Enable help command
			flag: true, // Enable --help global option
			showHelpWhenNoCommandSpecified: true, // Show help when no command is specified
			notes: [
				"Welcome to my CLI application!",
				"Use --help to see available commands and options.",
			],
			examples: [
				["my-cli --help", "Show help information"],
				["my-cli hello", "Execute greeting command"],
			],
			banner: "Welcome to My CLI application!", // Custom banner
			formatters: {
				// Custom type formatting functions
				formatFlagType: (type: FlagType) => {
					if (typeof type === "function") {
						return type.name;
					}

					return `Array<${type[0].name}>`;
				},
			},
		}),
	)
	.parse();
```

### Using cli.store.help

The help plugin also provides a shared API that allows you to dynamically modify properties like help groups at runtime.

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("My CLI application")
	.version("1.0.0")
	.use(
		helpPlugin({
			groups: {
				commands: [
					["dev", "Development Commands"],
					["build", "Build Commands"],
				],
				flags: [
					["input", "Input Options"],
					["output", "Output Options"],
				],
			},
		}),
	)
	.command("dev", "Start development server", {
		help: {
			group: "dev", // Assign to the "dev" group
		},
	})
	.command("build", "Build the application", {
		help: {
			group: "build", // Assign to the "build" group
		},
	})
	.on("dev", (ctx) => {
		console.log("Development server started");
	})
	.on("build", (ctx) => {
		console.log("Application built");
	})
	.parse();

cli.store.help.addGroup({
	commands: [["test", "Test"]],
});
```

#### Store API Methods

- `ctx.store.help.addGroup(options)`: Dynamically add help groups at runtime
  - `options.commands`: Array of `[key, name]` tuples for command groups
  - `options.flags`: Array of `[key, name]` tuples for flag groups
  - `options.globalFlags`: Array of `[key, name]` tuples for global flag groups

This allows you to organize your help output into logical sections, making it easier for users to find relevant commands and options.
