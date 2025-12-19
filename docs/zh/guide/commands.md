---
title: 命令
---

# 命令

命令是 CLI 的核心组成部分。每个命令都有一个名称、描述、选项和参数。您可以使用命令来执行特定的任务或操作。

## 基础用法

```ts
const cli = Cli()
	.scriptName("foo-cli")
	.description("一个简单的 CLI")
	.version("1.0.0")
	.command("foo", "一个 foo 命令")
	.on("foo", (ctx) => {
		console.log("It works!");
	})
	.parse();
```

这将创建一个名为 `foo-cli` 的 CLI 应用程序，其中包含一个名为 `foo` 的命令。当用户运行 `foo-cli foo` 时，CLI 将输出 "It works!"。

## 可选描述

描述参数是可选的。如果你不需要记录命令，可以省略它：

```ts
const cli = Cli()
	.scriptName("foo-cli")
	.description("一个简单的 CLI")
	.version("1.0.0")
	.command("foo", {
		// 无描述，直接传递选项
		flags: {
			output: {
				type: String,
				description: "输出文件",
			},
		},
	})
	.on("foo", (ctx) => {
		console.log("It works!");
	})
	.parse();
```

或者，你也可以使用带有描述的传统语法：

```ts
const cli = Cli()
	.scriptName("foo-cli")
	.description("一个简单的 CLI")
	.version("1.0.0")
	.command("foo", "一个 foo 命令", {
		flags: {
			output: {
				type: String,
				description: "输出文件",
			},
		},
	})
	.parse();
```

## 别名

### 概述

命令别名允许用户使用替代名称来调用命令。这对于提供更短或更直观的命令名称很有用。

### 单个别名

你可以使用字符串为命令定义单个别名：

```ts
const cli = Cli()
	.scriptName("foo-cli")
	.description("一个简单的 CLI")
	.version("1.0.0")
	.command("foo", "一个 foo 命令", {
		alias: "f",
	})
	.on("foo", (ctx) => {
		console.log("It works!");
	})
	.parse();
```

现在 `foo-cli foo` 和 `foo-cli f` 都会输出 "It works!"。

### 多个别名

你可以使用数组为命令定义多个别名：

```ts
const cli = Cli()
	.scriptName("foo-cli")
	.description("一个简单的 CLI")
	.version("1.0.0")
	.command("foo", "一个 foo 命令", {
		alias: ["f", "bar", "baz"],
	})
	.on("foo", (ctx) => {
		console.log("It works!");
	})
	.parse();
```

现在 `foo-cli foo`、`foo-cli f`、`foo-cli bar` 和 `foo-cli baz` 都以相同的方式工作。

### 实践示例

#### 示例：Git 风格的缩写

```ts
const cli = Cli()
	.scriptName("git")
	.command("status", "显示工作树状态", {
		alias: "st",
	})
	.on("status", (ctx) => {
		console.log("在分支 main 上...");
	})
	.command("commit", "记录对存储库的更改", {
		alias: ["ci", "com"],
	})
	.on("commit", (ctx) => {
		console.log("提交更改...");
	})
	.command("checkout", "切换分支或恢复文件", {
		alias: "co",
	})
	.on("checkout", (ctx) => {
		console.log("检出中...");
	})
	.parse();
```

使用：

```sh
$ git st
$ git commit
$ git ci
$ git com
$ git checkout
$ git co
```

## 子命令

你可以通过在命令名称中使用空格来定义子命令：

```ts
const cli = Cli()
	.scriptName("foo-cli")
	.description("一个简单的 CLI")
	.version("1.0.0")
	.command("parent child", "一个子命令")
	.on("parent child", (ctx) => {
		console.log("子命令被调用了！");
	})
	.parse();
```

## 根命令

你可以定义一个根命令（没有名称的命令）来处理没有指定子命令时的情况：

```ts
const cli = Cli()
	.scriptName("foo-cli")
	.description("一个简单的 CLI")
	.version("1.0.0")
	.command("", "根命令")
	.on("", (ctx) => {
		console.log("根命令被调用了！");
	})
	.parse();
```

## 参数

### 通用

参数（也称为 _位置参数_）是与参数值相对应的名称。将参数视为变量名，将参数值视为与变量关联的值。

可以在 `parameters` 数组属性中定义参数，以便通过名称访问特定的参数。这对于编写更可读的代码、强制验证和生成帮助文档非常有用。

参数可以按照以下格式进行定义：

- **必需参数**由尖括号表示（例如 `<parameter name>`）。
- **可选参数**由方括号表示（例如 `[parameter name]`）。
- **扩展参数**由 `...` 后缀表示（例如 `<parameter name...>` 或 `[parameter name...]`）。

注意，必需参数**不能在可选参数之后**，扩展参数必须放在最后。

可以在 `ctx.parameters` 属性上使用驼峰命名法来访问参数。

示例：

```ts
// $ node ./foo-cli.mjs a b c d

const cli = Cli()
	.scriptName("foo-cli")
	.description("一个简单的 CLI")
	.version("1.0.0")
	.command("foo", "一个 foo 命令", {
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

### 结束标志

结束标志（`--`）（也称为 _选项结束符_）允许用户传递一部分参数。这对于将应该与其他参数分开解析的参数或看起来像选项的参数非常有用。

一个例子是 [`npm run`](https://docs.npmjs.com/cli/v8/commands/npm-run-script)：

```sh
$ npm run <script> -- <script arguments>
```

`--` 表示之后的所有参数应该传递给 _script_ 而不是 _npm_。

你可以在 `parameters` 数组中指定 `--` 来解析选项结束符参数。

示例：

```ts
// $ node ./foo-cli.mjs echo -- hello world

const cli = Cli()
	.scriptName("foo-cli")
	.description("一个简单的 CLI")
	.version("1.0.0")
	.command("echo", "回显", {
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

## 选项

请参见[选项文档](./flags)。

## 忽略

有时，您可能希望在命令行输入中忽略某些参数或选项。例如 `deno` 的这个用法：

```sh
deno run --allow-read script.ts --flag
```

其中， `--flag` 被直接传递给脚本，而不是 `deno`。

您可以使用 `ignore` 属性来指定要忽略的参数或选项，从而实现这种用法。

```ts
import { PARAMETER } from "clerc";

let encounteredParameter = false;

const cli = Cli()
	.scriptName("deno")
	.description("Deno CLI")
	.version("1.0.0")
	.command("run", "运行脚本", {
		flags: {
			allowRead: {
				type: Boolean,
				description: "允许读取文件系统",
			},
		},
		parameters: ["<script>", "[args...]"],
		ignore: (type) => {
			if (type === PARAMETER && !encounteredParameter) {
				encounteredParameter = true;

				return false; // 不要忽略第一个参数（脚本名称）
			}

			// 忽略其余的参数
			return encounteredParameter;
		},
	})
	.on("run", (ctx) => {
		// 处理脚本运行
		ctx.ignored; // => ["--flag"]
		//	^?
	})
	.parse();
```

## 多个命令

你可以通过将一个使用 `defineCommand` 创建的命令数组数组传递给 `command()` 方法来一次注册多个命令。

```ts
import { defineCommand } from "clerc";

const commandA = defineCommand(
	{
		name: "foo",
		description: "Foo 命令",
	},
	(ctx) => {
		console.log("执行 Foo 命令");
	},
);
const commandB = defineCommand(
	{
		name: "bar",
		description: "Bar 命令",
		flags: {
			flag: {
				type: Boolean,
				default: false,
			},
		},
	},
	(ctx) => {
		console.log("执行 Bar 命令");
	},
);

const cli = Cli()
	.scriptName("foo-cli")
	.description("一个简单的 CLI")
	.version("1.0.0")
	.command([commandA, commandB])
	.parse();
```

## 高级用法

为了将处理程序与 cli 定义分离，可以使用 `defineCommand` 实用函数：

```ts
import { defineCommand } from "clerc";

const command = defineCommand({
	name: "test",
	description: "测试",
	flags: {},
	parameters: [],
	handler: (ctx) => {
		// 处理程序
	},
});

const cli = Cli()
	.scriptName("foo-cli")
	.description("一个简单的 CLI")
	.version("1.0.0")
	.command(command)
	.parse();
```

## 懒加载

懒加载允许你延迟加载命令处理器，直到它们被实际调用。这对于减少启动时间和内存使用非常有用，特别是当你有许多命令或重量级处理器时。

你可以通过在处理器中使用动态导入（`await import()`）来实现懒加载：

### 基本懒加载

```ts
const cli = Cli()
	.scriptName("app")
	.description("一个带有懒加载的应用程序")
	.version("1.0.0")
	.command("build", "构建项目", {
		flags: {
			production: {
				type: Boolean,
				description: "为生产环境构建",
			},
		},
	})
	.on("build", async (ctx) => {
		// 处理器仅在调用命令时加载
		const { buildProject } = await import("./handlers/build.js");
		await buildProject(ctx);
	})
	.command("deploy", "部署应用程序", {
		flags: {
			environment: {
				type: String,
				default: "staging",
				description: "目标环境",
			},
		},
	})
	.on("deploy", async (ctx) => {
		// 另一个懒加载的处理器
		const { deploy } = await import("./handlers/deploy.js");
		await deploy(ctx);
	})
	.parse();
```

### 使用 defineCommand 的懒加载

你也可以将懒加载与 `defineCommand` 实用函数结合使用：

```ts
import { defineCommand } from "clerc";

const command = defineCommand({
	name: "migrate",
	description: "运行数据库迁移",
	flags: {},
	parameters: [],
	handler: async (ctx) => {
		// 处理器仅在调用命令时加载
		const { runMigrations } = await import("./handlers/migrate.js");
		await runMigrations(ctx);
	},
});

const cli = Cli()
	.scriptName("app")
	.description("带有懒加载命令的应用程序")
	.version("1.0.0")
	.command(command)
	.parse();
```

### 优势

- **更快的启动时间**：仅加载被调用命令的处理器
- **更低的内存使用**：未使用的处理器不消耗内存
- **更好的可扩展性**：易于添加许多命令而不影响性能
- **异步操作**：处理器可以执行异步操作，如文件 I/O 或网络请求

### 示例：模块化命令结构

目录结构：

```
project/
├── cli.ts
├── handlers/
│   ├── build.ts
│   ├── dev.ts
│   ├── deploy.ts
│   └── test.ts
```

`handlers/build.ts`：

```ts
export async function buildProject(ctx) {
	if (ctx.flags.production) {
		console.log("为生产环境构建...");
	} else {
		console.log("为开发环境构建...");
	}
}
```

`cli.ts`：

```ts
const cli = Cli()
	.scriptName("app")
	.version("1.0.0")
	.command("build", "构建项目", {
		flags: {
			production: {
				type: Boolean,
				description: "为生产环境构建",
			},
		},
	})
	.on("build", async (ctx) => {
		const { buildProject } = await import("./handlers/build.js");
		await buildProject(ctx);
	})
	.command("dev", "启动开发服务器", {})
	.on("dev", async (ctx) => {
		const { startDev } = await import("./handlers/dev.js");
		await startDev(ctx);
	})
	.command("deploy", "部署应用程序")
	.on("deploy", async (ctx) => {
		const { deploy } = await import("./handlers/deploy.js");
		await deploy(ctx);
	})
	.parse();
```
