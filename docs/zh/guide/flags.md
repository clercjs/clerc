---
title: 选项
---

# 选项

选项用于为命令提供额外的配置和参数。Clerc 支持多种类型的选项，包括 JavaScript 内置的类型，如布尔值、字符串、数字等，也支持自定义类型。

_Clerc_ 的选项解析由 [`@clerc/parser`](https://github.com/clercjs/clerc/blob/main/packages/parser) 提供支持，并具有许多功能：

- 数组和自定义类型
- 选项分隔符：`--flag value`、`--flag=value`、`--flag:value` 和 `--flag.value`
- 组合别名：`-abcd 2` → `-a -b -c -d 2`
- [选项结束符](https://unix.stackexchange.com/a/11382)：传递 `--` 来结束选项解析

可以在 `flags` 对象属性中指定选项，其中键是选项名称，值是选项类型函数或描述选项的对象。

建议使用驼峰命名法作为选项名称，因为它将被解释为解析短横线分隔的等效选项。

选项类型函数可以是任何接受字符串并返回解析后的值的函数。默认的 JavaScript 构造函数应该涵盖大多数用例：[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/String)、[Number](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/Number)、[Boolean](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean/Boolean) 等。

选项描述对象可用于存储有关选项的其他信息，例如 `alias`、`default` 和 `description`。要接受选项的多个值，请将类型函数包装在数组中。

所有提供的信息将用于生成更好的帮助文档。

## 选项别名

选项别名允许用户使用更短的或替代的名称来指定选项。这对于为常用的选项提供便捷的快捷方式很有用。

### 单个别名

你可以使用字符串为选项定义单个别名：

```ts
const cli = Cli()
	.command("build", "构建项目", {
		flags: {
			output: {
				type: String,
				alias: "o",
				description: "输出目录",
			},

			verbose: {
				type: Boolean,
				alias: "v",
				description: "启用详细输出",
			},
		},
	})
	.on("build", (ctx) => {
		// $ node cli.mjs build --output dist
		// $ node cli.mjs build -o dist
		// 两者的工作方式相同
		// $ node cli.mjs build --verbose
		// $ node cli.mjs build -v
		// 两者都启用详细输出
	})
	.parse();
```

### 多个别名

你可以使用数组为选项定义多个别名：

```ts
const cli = Cli()
	.command("config", "配置应用", {
		flags: {
			config: {
				type: String,
				alias: ["c", "cfg"],
				description: "配置文件路径",
			},

			format: {
				type: String,
				alias: ["f", "fmt"],
				description: "输出格式",
			},
		},
	})
	.on("config", (ctx) => {
		// 所有这些都可以工作：
		// $ node cli.mjs config --config file.json
		// $ node cli.mjs config -c file.json
		// $ node cli.mjs config -cfg file.json
		// $ node cli.mjs config --format json
		// $ node cli.mjs config -f json
		// $ node cli.mjs config -fmt json
	})
	.parse();
```

### 组合短别名

使用短别名（单个字符）时，它们可以组合在一起：

```ts
const cli = Cli()
	.command("compress", "压缩文件", {
		flags: {
			output: {
				type: String,
				alias: "o",
				description: "输出文件",
			},

			verbose: {
				type: Boolean,
				alias: "v",
				description: "详细输出",
			},

			recursive: {
				type: Boolean,
				alias: "r",
				description: "递归模式",
			},
		},
	})
	.on("compress", (ctx) => {
		// $ node cli.mjs compress -vrh input.zip
		// 等同于：
		// $ node cli.mjs compress -v -r -h input.zip
		// 这设置了：verbose = true，recursive = true，并将 "input.zip" 作为参数传递
	})
	.parse();
```

## 标志描述

`description` 属性是可选的，如果你不需要记录标志，可以省略它：

```ts
const cli = Cli()
	.command("build", "构建项目", {
		flags: {
			verbose: {
				type: Boolean,
				// 描述是可选的
			},

			output: {
				type: String,
				description: "输出目录", // 或包含它以获得更好的文档
			},
		},
	})
	.parse();
```

## 标志类型

关于标志类型的详细信息，包括内置基础类型（String、Boolean、Array、Counter、Object）和高级类型（Enum、Range、Regex），以及自定义类型定义，请参阅[类型](./types)指南。
