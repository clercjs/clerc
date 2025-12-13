---
title: 上下文
---

# 上下文

在 `handler` 和 `interceptor` 中，接收到的第一个参数均为一个上下文对象。这两种情况下的上下文键均相同，只有部分值会有所不同。

## 类型

```ts
export interface BaseContext<
	C extends Command = Command,
	GF extends ClercFlagsDefinition = {},
> {
	resolved: boolean;
	command?: C;
	calledAs?: string;
	parameters: InferParameters<NonNullable<C["parameters"]>>;
	flags: InferFlagsWithGlobal<C, GF>;
	ignored: string[];
	rawParsed: ParsedResult<InferFlagsWithGlobal<C, GF>>;
	missingParameters: boolean;
	store: Partial<ContextStore>;
}
```

- `resolved`：一个布尔值，指示是否找到了匹配的命令。
- `command`：当前解析的命令对象，如果没有匹配的命令则为 `undefined`。
- `calledAs`：用户调用的命令名称（可能是别名）。
- `parameters`：一个对象，包含解析后的参数值。如果没有匹配到命令，则为空对象。
- `flags`：一个对象，包含解析后的选项值。如果没有匹配到命令，则为空对象。
- `ignored`：一个字符串数组，包含未被解析的参数。
- `rawParsed`：包含原始解析结果的对象，包括所有参数和选项的详细信息。ParsedResult
- `missingParameters`：一个布尔值，指示是否缺少必需的参数。
- `store`：一个共享存储对象，可用于在 CLI 应用程序的不同部分之间存储数据。

`handler` 的上下文是 `BaseContext` 的一个特化。它的 `resolved` 属性始终为 `true`，并且 `command` 属性始终为当前命令对象，`calledAs` 也始终有值。

## 存储 API

`ctx.store` 和 `cli.store` 都提供对共享存储对象的访问，该对象可用于在 CLI 应用程序的不同部分之间存储数据。它们是等价的 - `ctx.store` 是在构建上下文时创建的 `cli.store` 的副本。

### 使用方法

```ts
const cli = Clerc.create()
	.scriptName("my-cli")
	.description("我的 CLI 应用程序")
	.version("1.0.0")
	.use(helpPlugin())
	.command("config", "配置应用程序")
	.on("config", (ctx) => {
		// 存储配置数据
		ctx.store.config = {
			apiUrl: "https://api.example.com",
			timeout: 5000,
		};

		console.log("配置已保存");
	})
	.command("status", "显示应用程序状态")
	.on("status", (ctx) => {
		// 访问存储的配置数据
		const config = ctx.store.config;
		if (config) {
			console.log(`API URL: ${config.apiUrl}`);
			console.log(`超时时间: ${config.timeout}ms`);
		} else {
			console.log("未找到配置");
		}
	})
	.parse();

// 也可以通过 cli.store 访问存储
const config = cli.store.config;
```

### 存储与上下文存储的区别

- `cli.store`：附加到 CLI 实例的主存储对象。在此处所做的更改在所有命令执行之间保持持久。
- `ctx.store`：为每个命令执行创建的 `cli.store` 副本。在此处所做的更改仅限于该特定执行。

### 插件扩展

插件可以扩展 `ContextStore` 接口以添加自己的存储属性：

```ts
// 在插件中
declare module "@clerc/core" {
	export interface ContextStore {
		help: {
			addGroup: (options: GroupsOptions) => void;
		};
	}
}

cli.store.help.addGroup({
	commands: [["custom", "自定义命令"]],
});
```

这允许插件提供自己的存储 API，可以通过存储对象访问。
