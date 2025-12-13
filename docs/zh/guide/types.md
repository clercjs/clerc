---
title: 类型
---

# 类型

类型允许你验证、转换和解析选项和参数的值。Clerc 提供了多个内置的类型函数，也支持自定义类型。

## 内置基础类型

Clerc 支持标准的 JavaScript 类型构造函数以处理常见的用例：

- **String**: 用于字符串值（默认值：`undefined`）
- **Number**: 用于数字值（可以直接使用）
- **Boolean**: 用于布尔开关（默认值：`false`）
- **Object**: 用于键值对（默认值：`{}`）

### String 类型

`String` 类型用于接受字符串值的选项和参数。这是最基础的类型。

**默认值行为：** 如果未指定，其值为 `undefined`（除非设置了 `default` 属性）。

```ts
const cli = Cli()
	.command("greet", "问候某人", {
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

Boolean 类型支持 `negatable` 属性，允许你决定是否启用否定选项。默认情况下，`negatable` 为 `true`，这意味着 `--no-flag` 会将 `flag` 选项设置为 `false`。

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

`Array` 类型用于接受多个值的选项和参数。通过将类型函数包装在数组中来定义：

**默认值行为：** 如果未指定，其值为 `[]`（空数组）。

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

### 计数器类型

计数器类型用于计算选项被指定的次数。通过使用 `[Boolean]` 类型可以实现计数器功能：

**默认值行为：** 如果未指定，其值为 `0`。

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

**默认值行为：** 如果未指定，其值为 `{}`（空对象）。

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

:::info

如果你想传入类似 `K=V` 这样的键值对，可以在命令行中使用冒号分隔符：

```bash
$ node cli.mjs config --define:env=production --define:version=1.0.0
```

实际上 `--define=env=production` 也可以正常工作，只是看起来不太直观。

:::

## 内置的高级类型

Clerc 提供了一些内置的高级类型函数，方便处理常见的需求：

- `Enum`: 限制选项和参数值为预定义的集合。
- `Range`: 限制数字值在特定范围内并转换为数字。
- `Regex`: 验证值是否符合正则表达式模式。

这些类型函数可以同时用于选项和参数，允许你在整个 CLI 中共享相同的类型定义：

```ts
import { Types } from "clerc";

Cli()
	.command("serve", "启动服务器", {
		flags: {
			mode: {
				type: Types.Enum("development", "production", "test"),
				default: "development" as const,
				description: "设置应用程序模式",
			},
		},
		parameters: [
			{
				key: "[port]",
				type: Types.Range(1024, 65_535),
				description: "端口号",
			},
		],
	})
	.on("serve", (ctx) => {
		ctx.flags.mode;
		//        ^?
		ctx.parameters.port;
		//             ^?
	})
	.parse();
```

### Enum 类型

限制选项或参数值为一组预定义的选项：

```ts
import { Types } from "clerc";

const cli = Cli()
	.scriptName("build-cli")
	.description("构建工具")
	.version("1.0.0")
	.command("config", "配置构建设置", {
		flags: {
			format: {
				type: Types.Enum("json", "yaml", "toml"),
				description: "输出格式",
			},
		},
		parameters: [
			{
				key: "<setting>",
				type: Types.Enum("output", "target", "format"),
				description: "设置名称",
			},
			{
				key: "<value>",
				description: "设置值",
			},
		],
	})
	.on("config", (ctx) => {
		console.log(`设置 ${ctx.parameters.setting} = ${ctx.parameters.value}`);
	})
	.parse();
```

使用方法：

```bash
$ build-cli config --format json output dist
$ build-cli config --format yaml target es2020
$ build-cli config --format invalid value
# Error: Invalid value: invalid. Must be one of: json, yaml, toml
```

### Range 类型

限制数字值在特定范围内并转换为数字：

```ts
import { Types } from "clerc";

const cli = Cli()
	.scriptName("server-cli")
	.description("服务器管理工具")
	.version("1.0.0")
	.command("start", "启动服务器", {
		flags: {
			port: {
				type: Types.Range(1024, 65_535),
				description: "端口号",
			},
		},
		parameters: [
			{
				key: "[timeout]",
				type: Types.Range(1, 3600),
				description: "超时时间（秒）",
			},
		],
	})
	.on("start", (ctx) => {
		const port = ctx.flags.port ?? 3000;
		console.log(`在端口 ${port} 启动服务器`);
	})
	.parse();
```

使用方法：

```bash
$ server-cli start --port 3000
$ server-cli start --port 8080
$ server-cli start --port 100
# Error: Invalid value: 100. Must be a number between 1024 and 65535
```

### Regex 类型

验证值是否符合正则表达式模式：

```ts
import { Types } from "clerc";

const cli = Cli()
	.scriptName("git-clone")
	.description("克隆仓库")
	.version("1.0.0")
	.command("clone", "克隆一个仓库", {
		parameters: [
			{
				key: "<repo>",
				type: Types.Regex(/^[\w\-.]+\/[\w\-.]+$/, "owner/repo format"),
				description: "格式为 owner/repo 的仓库",
			},
		],
	})
	.on("clone", (ctx) => {
		console.log(`克隆 ${ctx.parameters.repo}`);
	})
	.parse();
```

使用方法：

```bash
$ git-clone clone clercjs/clerc
$ git-clone clone myorg/myrepo
$ git-clone clone invalid
# Error: Invalid value: invalid. Must match: owner/repo format
```

## 自定义类型

你可以通过提供一个接受字符串参数并返回解析后的值的函数来创建自定义类型。

```ts
// 自定义类型函数，将逗号分隔的字符串解析为字符串数组
const CommaSeparatedList = (value: string): string[] =>
	value.split(",").map((item) => item.trim());

const cli = Cli()
	.scriptName("custom-cli")
	.description("使用自定义类型的 CLI")
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

自定义类型函数也可以与数组语法一起使用，以接受多个值：

```ts
const cli = Cli()
	.command("process", "处理文件", {
		flags: {
			// 使用 [CommaSeparatedList] 来接受多个逗号分隔的列表
			patterns: {
				type: [CommaSeparatedList],
				alias: "p",
				description: "文件模式（逗号分隔）",
			},
		},
	})
	.on("process", (ctx) => {
		// $ node cli.mjs process -p "*.js,*.ts" -p "src/**"
		ctx.flags.patterns; // => [["*.js", "*.ts"], ["src/**"]]
	})
	.parse();
```
