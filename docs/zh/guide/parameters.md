---
title: 参数
---

# 参数

参数（也称为*位置参数*）是与参数值相对应的名称。将参数想象为变量名，参数值为与变量相关联的值。

本指南涵盖参数定义、类型和描述。

## 基本参数定义

你可以在 `parameters` 数组属性中定义参数，以通过名称访问特定的参数。参数可以采用以下格式定义：

- **必需参数**用尖括号表示（例如 `<parameter name>`）。
- **可选参数**用方括号表示（例如 `[parameter name]`）。
- **展开参数**用 `...` 后缀表示（例如 `<parameter name...>` 或 `[parameter name...]`）。

注意，必需参数**不能出现在可选参数之后**，并且展开参数必须放在最后。

参数可以使用 `ctx.parameters` 属性上的 camelCase 记号访问。

例子：

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

## 参数对象

对于更高级的参数配置，你可以使用参数对象而不是简单字符串。参数对象允许你：

- 添加类型来验证和转换参数值
- 添加描述用于文档和帮助输出

### 基本参数对象

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

## 参数类型

参数类型允许你验证、转换和解析参数值，并在帮助文档中提供有效的选项。参数类型与[标志类型](./flags.md#flag-types-explained)使用相同的函数，这意味着你可以在参数和标志之间共享相同的类型定义。当为参数指定类型时，解析的值将自动转换为该类型。

### 使用类型函数

Clerc 提供了几个内置的类型工厂函数：

#### 枚举类型

将参数值限制为一组预定义的选项：

```ts
import { Types } from "clerc";

const cli = Cli()
	.scriptName("build-cli")
	.description("Build tool")
	.version("1.0.0")
	.command("config", "Configure build settings", {
		parameters: [
			{
				key: "<setting>",
				type: Types.Enum("output", "target", "format"),
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

使用方法：

```bash
$ build-cli config output dist
$ build-cli config target es2020
$ build-cli config invalid value
# Error: Invalid value: invalid. Must be one of: output, target, format
```

#### 范围类型

将数值参数限制在特定范围内并转换为数字：

```ts
import { Types } from "clerc";

const cli = Cli()
	.scriptName("server-cli")
	.description("Server management tool")
	.version("1.0.0")
	.command("start", "Start the server", {
		parameters: [
			{
				key: "[port]",
				type: Types.Range(1024, 65_535),
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

使用方法：

```bash
$ server-cli start 3000
$ server-cli start 8080
$ server-cli start 100
# Error: Invalid value: 100. Must be a number between 1024 and 65535
```

#### 正则表达式类型

针对正则表达式模式验证参数值：

```ts
import { Types } from "clerc";

const cli = Cli()
	.scriptName("git-clone")
	.description("Clone repository")
	.version("1.0.0")
	.command("clone", "Clone a repository", {
		parameters: [
			{
				key: "<repo>",
				type: Types.Regex(/^[\w\-.]+\/[\w\-.]+$/, "owner/repo format"),
				description: "Repository in owner/repo format",
			},
		],
	})
	.on("clone", (ctx) => {
		console.log(`Cloning ${ctx.parameters.repo}`);
	})
	.parse();
```

## 文件结尾符

文件结尾符（`--`）（也称为*标志终止符*）允许用户传递一部分参数。这对于需要与其他参数分开解析的参数或看起来像标志的参数很有用。

一个例子是 [`npm run`](https://docs.npmjs.com/cli/v8/commands/npm-run-script)：

```sh
$ npm run <script> -- <script arguments>
```

`--` 表示之后的所有参数应该传递给*脚本*而不是*npm*。

你可以在 `parameters` 数组中指定 `--` 来解析标志终止符参数。

例子：

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
