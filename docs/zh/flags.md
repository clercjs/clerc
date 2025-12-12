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

## 基本用法

```ts
// $ node ./foo-cli.mjs echo --some-boolean --some-string hello --some-number 1 -n 2

const cli = Cli()
	.scriptName("foo-cli")
	.description("一个简单的 CLI")
	.version("1.0.0")
	.command("echo", "回显", {
		flags: {
			someBoolean: {
				type: Boolean,
				description: "一些布尔选项",
			},

			someString: {
				type: String,
				description: "一些字符串选项",
				default: "n/a",
			},

			someNumber: {
				// 将类型函数包装在数组中以允许多个值
				type: [Number],
				alias: "n",
				description: "数字数组。 (例如 -n 1 -n 2 -n 3)",
			},

			object: {
				type: Object,
				description: "一个对象选项。 (例如 --object.key value)",
			},

			counter: {
				type: [Boolean],
				description: "一个计数器选项。 (例如 -c -c -c)",
			},

			any: {
				type: Boolean as any,
				description: "一个任意类型选项，值会被解析为 any。",
			},
		},
	})
	.on("echo", (ctx) => {
		ctx.flags;
		//  ^?
		ctx.flags.someBoolean; // => true
		ctx.flags.someString; // => "hello"
		ctx.flags.someNumber; // => [1, 2]
		ctx.flags.object; // => { key: "value" }
		ctx.flags.counter; // => 2
	})
	.parse();
```

## 选项类型详解

### String 类型

`String` 类型用于接受字符串值的选项。这是最基础的选项类型。

**默认值行为：** 如果未指定该选项，其值为 `undefined`（除非设置了 `default` 属性）。

```ts
const cli = Cli()
	.command("greet", "问候", {
		flags: {
			name: {
				type: String,
				description: "用户名",
				default: "世界",
			},

			message: {
				type: String,
				alias: "m",
				description: "问候信息",
			},
		},
	})
	.on("greet", (ctx) => {
		console.log(`${ctx.flags.message}, ${ctx.flags.name}!`);
		// $ node cli.mjs greet --name 张三 --message 你好
		// 你好, 张三!
		// $ node cli.mjs greet --message 你好
		// ctx.flags.message => "你好"
		// ctx.flags.name => "世界" (使用默认值)
	})
	.parse();
```

### Boolean 类型

`Boolean` 类型用于创建布尔开关选项。默认情况下，只需提及选项名称即可将其设置为 `true`。

**默认值行为：** 如果未指定该选项，其值为 `false`。

```ts
const cli = Cli()
	.command("build", "构建项目", {
		flags: {
			production: {
				type: Boolean,
				description: "构建生产版本",
			},

			watch: {
				type: Boolean,
				alias: "w",
				description: "启用监视模式",
			},
		},
	})
	.on("build", (ctx) => {
		// $ node cli.mjs build --production --watch
		ctx.flags.production; // => true
		ctx.flags.watch; // => true

		// $ node cli.mjs build
		ctx.flags.production; // => false
		ctx.flags.watch; // => false
	})
	.parse();
```

#### Boolean 的 Negatable 属性

Boolean 类型支持 `negatable` 属性，允许你决定是否启用否定选项。默认情况下，`negatable` 为 `true`，这意味着默认情况下 `--no-flag` 会将 `flag` 选项设置为 `false`。

```ts
const cli = Cli()
	.command("start", "启动应用", {
		flags: {
			color: {
				type: Boolean,
				negatable: true, // 默认
				description: "启用彩色输出",
				default: true,
			},

			cache: {
				type: Boolean,
				negatable: false, // 禁用否定形式
				description: "启用缓存",
				default: true,
			},
		},
	})
	.on("start", (ctx) => {
		// $ node cli.mjs start
		ctx.flags.color; // => true
		ctx.flags.cache; // => true

		// $ node cli.mjs start --no-color --no-cache
		ctx.flags.color; // => false
		ctx.flags.cache; // => true

		// 必须使用 --cache=false 来禁用缓存
		// $ node cli.mjs start --cache=false
		ctx.flags.cache; // => false
	})
	.parse();
```

### Array 类型

`Array` 类型用于接受多个值的选项。通过将类型函数包装在数组中来定义：

**默认值行为：** 如果未指定该选项，其值为 `[]`（空数组）。

```ts
const cli = Cli()
	.command("copy", "复制文件", {
		flags: {
			// 使用 [String] 来接受多个字符串值
			include: {
				type: [String],
				alias: "i",
				description: "包含的文件模式",
			},

			// 使用 [Number] 来接受多个数字值
			ports: {
				type: [Number],
				alias: "p",
				description: "要监听的端口",
			},
		},
	})
	.on("copy", (ctx) => {
		// $ node cli.mjs copy -i "*.js" -i "*.ts" -p 3000 -p 3001
		ctx.flags.include; // => ["*.js", "*.ts"]
		ctx.flags.ports; // => [3000, 3001]

		// $ node cli.mjs copy
		ctx.flags.include; // => []
		ctx.flags.ports; // => []
	})
	.parse();
```

:::tip

如果你希望传入类似 `K=V` 这样的键值对，可以选择在命令行中使用冒号分隔符：

```bash
$ node cli.mjs config --define:env=production --define:version=1.0.0
```

实际上 `--define=env=production` 也可以正常工作，只是看起来不太直观。

:::

### 计数器类型

计数器类型用于计算选项被指定的次数。通过使用 `[Boolean]` 类型可以实现计数器功能：

**默认值行为：** 如果未指定该选项，其值为 `0`。

```ts
const cli = Cli()
	.command("log", "显示日志", {
		flags: {
			// [Boolean] 类型会计数选项被使用的次数
			verbose: {
				type: [Boolean],
				alias: "v",
				description: "详细日志级别（-v, -vv, -vvv）",
			},
		},
	})
	.on("log", (ctx) => {
		// $ node cli.mjs log -v
		ctx.flags.verbose; // => 1

		// $ node cli.mjs log -vvv
		ctx.flags.verbose; // => 3

		// $ node cli.mjs log -v -v -v
		ctx.flags.verbose; // => 3

		// $ node cli.mjs log
		ctx.flags.verbose; // => 0
	})
	.parse();
```

### Object 类型

`Object` 类型用于接受键值对形式的选项。使用点号或其他分隔符来指定对象的属性：

**默认值行为：** 如果未指定该选项，其值为 `{}`（空对象）。

```ts
const cli = Cli()
	.command("config", "配置应用", {
		flags: {
			define: {
				type: Object,
				alias: "d",
				description: "定义环境变量",
			},
		},
	})
	.on("config", (ctx) => {
		// $ node cli.mjs config --define.apiUrl http://api.example.com --define.debug
		ctx.flags.define; // => { apiUrl: "http://api.example.com", debug: true }

		// $ node cli.mjs config
		ctx.flags.define; // => {}
	})
	.parse();
```

## 内置的高级类型

Clerc 提供了一些内置的高级选项类型，方便处理常见的需求：

- `Choices`: 限制选项值为预定义的集合。

```ts
import { Choices } from "clerc";

Cli()
	.command("serve", "启动服务器", {
		flags: {
			mode: {
				type: Choices("development", "production", "test"),
				default: "development" as const,
				description: "设置应用程序模式",
			},
		},
	})
	.on("serve", (ctx) => {
		ctx.flags.mode;
		//        ^?
	})
	.parse();
```

## 自定义选项类型

您可以通过提供自定义的类型函数来创建自定义选项类型。类型函数接受一个字符串参数并返回解析后的值。

```ts
// 自定义类型函数，将逗号分隔的字符串解析为字符串数组
const CommaSeparatedList = (value: string): string[] =>
	value.split(",").map((item) => item.trim());

const cli = Cli()
	.scriptName("custom-cli")
	.description("一个使用自定义选项类型的 CLI")
	.version("1.0.0")
	.command("list", "显示列表", {
		flags: {
			items: {
				type: CommaSeparatedList,
				default: [] as string[],
				description: "逗号分隔的字符串列表",
			},
		},
	})
	.on("list", (ctx) => {
		console.log("Items:", ctx.flags.items);
		//                              ^?
	})
	.parse();
```
