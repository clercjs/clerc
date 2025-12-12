---
title: 插件
---

# 插件

插件是一个可以接受 `Clerc` 实例并对其拓展的函数。

:::info

插件系统允许您根据需求添加丰富的功能。

:::

## 使用方法

```ts
import { definePlugin } from "clerc";

const plugin = definePlugin({
	setup: (cli) =>
		cli.command("foo", "一个 foo 命令").on("foo", (ctx) => {
			console.log("It works!");
		}),
});

const cli = Cli()
	.scriptName("foo-cli")
	.description("一个简单的 CLI")
	.version("1.0.0")
	.use(plugin)
	.parse();
```

## 开发方法

在 `setup` 函数中，你可以直接拿到 `Clerc` 实例，并对其进行各种配置和扩展，例如添加命令、事件监听器等。

```ts
import { definePlugin } from "clerc";

export const myPlugin = definePlugin({
	setup: (cli) => {
		// 在这里对 cli 进行扩展
		return cli.command("bar", "一个 bar 命令").on("bar", (ctx) => {
			console.log("Bar command executed!");
		});
	},
});
```

## 拓展选项类型

如果你的插件需要为命令或选项添加自定义类型，可以使用如下方法：

```ts
declare module "@clerc/core" {
	// 为命令添加自定义类型
	export interface CommandCustomOptions {
		foo: string;
	}

	// 为选项添加自定义类型
	export interface FlagCustomOptions {
		foo: string;
	}
}
```

## 发布插件

虽然不是必须的，但是建议你在发布插件时，使用如下的规范，以便用户更容易地识别和使用你的插件：

- 使用 `clerc-plugin-<name>` 作为包名。
- 在 `package.json` 中添加关键词 `clerc-plugin`。
