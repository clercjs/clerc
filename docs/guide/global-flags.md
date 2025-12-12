---
title: Global Flags
---

# Global Flags

Clerc supports registering one or more global flags that can be used across all commands.

More details about flags can be found in the [Flags Documentation](./flags).

## Basic Usage

```ts
Clerc.create()
	.scriptName("my-cli")
	.description("My CLI application")
	.version("1.0.0")
	.globalFlag("verbose", "Enable verbose output", {
		type: Boolean,
	}) // Global flag with description
	.command("run", "Run the application")
	.on("run", (ctx) => {
		if (ctx.flags.verbose) {
			console.log("Verbose mode enabled");
		}
		console.log("Running the application...");
	})
	.parse();
```

## Optional Description

The description parameter is optional. You can omit it if you don't need to document the flag:

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("My CLI application")
	.version("1.0.0")
	.globalFlag("verbose", {
		type: Boolean,
		// No description provided
	})
	.globalFlag("debug", "Enable debug mode", {
		type: Boolean,
		// Or with description
	})
	.parse();
```

## Alternative Syntax

Starting from version 1.0.0, you can also use the alternative syntax where the second parameter is an options object instead of a string description:

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("My CLI application")
	.version("1.0.0")
	// Using options object directly
	.globalFlag("verbose", {
		type: Boolean,
		description: "Enable verbose output",
	})
	// Or without description
	.globalFlag("debug", {
		type: Boolean,
	})
	.parse();
```
