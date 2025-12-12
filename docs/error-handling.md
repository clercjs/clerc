---
title: Error Handling
---

# Error Handling

Clerc supports registering an error handler function to handle errors that occur during command parsing, command runtime, and other processes.

## Example

```ts
Clerc.create()
	.scriptName("my-cli")
	.description("My CLI application")
	.version("1.0.0")
	.errorHandler((error: any) => {
		console.error("An error occurred:", error.message);
		// You can perform other actions as needed, such as logging the error or cleaning up resources
	})
	.command("run", "Run the application")
	.on("run", (ctx) => {
		throw new Error("Testing error handling");
	})
	.parse();
```
