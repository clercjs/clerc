---
title: Global Flags
---

# Global Flags

Clerc supports registering one or more global flags that can be used across all commands.

More details about flags can be found in the [Flags Documentation](./flags).

## Example

```ts
Clerc.create()
	.scriptName("my-cli")
	.description("My CLI application")
	.version("1.0.0")
	.globalFlag("verbose", "Enable verbose output", {
		type: Boolean,
	}) // Global flag
	.command("run", "Run the application")
	.on("run", (ctx) => {
		if (ctx.flags.verbose) {
			console.log("Verbose mode enabled");
		}
		console.log("Running the application...");
	})
	.parse();
```
