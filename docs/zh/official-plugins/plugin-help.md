---
title: 帮助信息插件
---

# @clerc/plugin-help

为您的 CLI 添加帮助信息的插件。

:::info

该插件已内置于 `clerc` 包中导出的 `Clerc` 类中，您无需单独安装即可使用。

:::

## 独立使用

### 📦 安装

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

### 🚀 使用方法

#### 导入

```ts
import { helpPlugin } from "@clerc/plugin-help";
// 或者直接从 clerc 导入
import { helpPlugin } from "clerc";
```

#### 基本用法

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("我的 CLI 应用程序")
	.version("1.0.0")
	.use(helpPlugin()) // 添加帮助插件
	.command("hello", "问候命令")
	.on("hello", (ctx) => {
		console.log("Hello, World!");
	})
	.parse();
```

## 运行效果

```bash
# 显示主帮助，在有根命令的时候显示根命令的帮助信息，没有的时候显示 CLI 自己的帮助信息
$ node my-cli --help
# 显示 CLI 自己的帮助信息
$ node my-cli help

# 显示特定命令的帮助
$ node my-cli hello --help
$ node my-cli help hello
```

## 📝 功能特性

### 自动生成帮助

插件会自动为您的 CLI 生成美观的帮助信息，包括：

- CLI 名称、版本信息和描述
- 可用命令列表
- 命令参数列表
- 命令选项
- 全局选项
- 自定义的提示信息和示例

## 高级用法

### 自定义命令帮助信息

你可以设置 `help` 选项来自定义每个命令的帮助信息：

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("我的 CLI 应用程序")
	.version("1.0.0")
	.use(helpPlugin())
	.command("deploy", "部署命令", {
		help: {
			showInHelp: true, // 在帮助信息中显示此命令
			notes: [
				"这是一个用于部署应用程序的命令。",
				"你可以使用不同的选项来控制部署行为。",
			],
			examples: [
				["my-cli deploy --env production", "部署到生产环境"],
				["my-cli deploy --env staging --force", "部署到暂存环境并强制执行"],
			],
		},
	})
	.parse();
```

### 插件选项

你可以通过传递选项来定制帮助插件的行为：

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("我的 CLI 应用程序")
	.version("1.0.0")
	.use(
		helpPlugin({
			command: true, // 启用 help 命令
			flag: true, // 启用 --help 全局选项
			showHelpWhenNoCommandSpecified: true, // 当没有指定命令时显示帮助信息
			notes: [
				"欢迎使用我的 CLI 应用程序！",
				"使用 --help 查看可用命令和选项。",
			],
			examples: [
				["my-cli --help", "显示帮助信息"],
				["my-cli hello", "执行问候命令"],
			],
			banner: "欢迎使用 My CLI 应用程序！", // 自定义横幅
			formatters: {
				// 自定义类型格式化函数
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
