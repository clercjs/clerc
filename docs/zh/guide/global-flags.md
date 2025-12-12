---
title: 全局选项
---

# 全局选项

Clerc 支持全局注册一个或多个选项，这些选项可以在所有命令中使用。

有关选项的详细信息，请参阅[选项文档](./flags)。

## 示例

```ts
Clerc.create()
	.scriptName("my-cli")
	.description("My CLI application")
	.version("1.0.0")
	.globalFlag("verbose", "Enable verbose output", {
		type: Boolean,
	}) // 全局选项
	.command("run", "Run the application")
	.on("run", (ctx) => {
		if (ctx.flags.verbose) {
			console.log("Verbose mode enabled");
		}
		console.log("Running the application...");
	})
	.parse();
```
