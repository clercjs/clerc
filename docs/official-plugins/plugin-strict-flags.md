---
title: Strict Flags Plugin
---

# @clerc/plugin-strict-flags

A plugin that throws an error when unknown flags are passed.

## 📦 Installation

:::code-group

```sh [npm]
$ npm install @clerc/plugin-strict-flags
```

```sh [yarn]
$ yarn add @clerc/plugin-strict-flags
```

```sh [pnpm]
$ pnpm add @clerc/plugin-strict-flags
```

:::

## 🚀 Usage

### Import

```ts
import { strictFlagsPlugin } from "@clerc/plugin-strict-flags";
// or import directly from clerc
import { strictFlagsPlugin } from "clerc";
```

### Basic Usage

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("My CLI application")
	.version("1.0.0")
	.use(strictFlagsPlugin()) // Add strict flags plugin
	.command("start", "Start service", {
		flags: {
			port: {
				type: Number,
				description: "Service port",
				default: 3000,
			},
			host: {
				type: String,
				description: "Service host",
				default: "localhost",
			},
		},
	})
	.on("start", (ctx) => {
		console.log(`Starting service on ${ctx.flags.host}:${ctx.flags.port}`);
	})
	.parse();
```

### Running Effect

```bash
# Correct usage
$ node my-cli start --port 8080 --host 0.0.0.0
# Output: Starting service on 0.0.0.0:8080

# Passing unknown flags will throw an error
$ node my-cli start --port 8080 --unknown-flag
# Unexpected flag: --unknown-flag
```
