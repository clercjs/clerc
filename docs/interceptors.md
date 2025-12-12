---
title: Interceptors
---

# Interceptors

Interceptors are functions that run before or after the command handler is called, similar to middleware in web development.

## Usage

You can add interceptors to your CLI using the `interceptor` method:

```ts
import { Clerc } from "clerc";

const cli = Clerc.create()
	.scriptName("foo-cli")
	.description("A simple CLI")
	.version("1.0.0")
	.command("foo", "A foo command")
	.interceptor(async (ctx, next) => {
		console.log("Before foo");
		// You can access the context
		console.log(ctx.resolved); // Was a matching command found?
		await next(); // Call next to continue execution
		console.log("After foo");
	})
	.parse();
```

:::warning

Attention! When calling `next`, make sure to use `await`, otherwise errors might not be caught properly!

:::

## Order

The `interceptor` method accepts either a function or an object:

```ts
const cli = Clerc.create()
	.scriptName("foo-cli")
	.description("A simple CLI")
	.version("1.0.0")
	.command("foo", "A foo command")
	.interceptor({
		enforce: "normal", // Default, or "pre", "post"
		handler: async (ctx, next) => {
			console.log("Before foo");
			// You can access the context
			console.log(ctx.resolved); // Was a matching command found?
			await next(); // Call next to continue execution
			console.log("After foo");
		},
	})
	.parse();
```

Therefore, the execution order is as follows:

1. Pre interceptors
2. Normal interceptors
3. Post interceptors

## Calling After the Command Handler

By performing operations after calling `next()`, you can execute some actions after the command handler is called:

```ts
const cli = Clerc.create()
	.scriptName("foo-cli")
	.description("A simple CLI")
	.version("1.0.0")
	.command("foo", "A foo command")
	.interceptor(async (ctx, next) => {
		console.log("Before foo");
		// You can access the context
		console.log(ctx.resolved); // Was a matching command found?
		await next(); // Call next to continue execution
		console.log("After foo");
	})
	.on("foo", (ctx) => {
		console.log("It ran!");
	})
	.parse();

// The output is:
// Before foo
// It ran!
// After foo
```

## Context Type

The context type for interceptors is `InterceptorContext`, which is currently an alias for `BaseContext`, but provides better IDE type display. [See the context documentation](./context) for more information.
