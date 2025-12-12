---
title: 上下文
---

# 上下文

在 `handler` 和 `interceptor` 中，接收到的第一个参数均为一个上下文对象。这两种情况下的上下文键均相同，只有部分值会有所不同。

## 类型

这是 [c1ac0a2](https://github.com/clercjs/clerc/commit/c1ac0a2c7a23ae7f26fe0d9b55fb4a27120131a8/packages/core/src/types/context.ts) 这个提交中定义的上下文类型：

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
}
```

- `resolved`：一个布尔值，指示是否找到了匹配的命令。
- `command`：当前解析的命令对象，如果没有匹配的命令则为 `undefined`。
- `calledAs`：用户调用的命令名称（可能是别名）。
- `parameters`：一个对象，包含解析后的参数值。如果没有匹配到命令，则为空对象。
- `flags`：一个对象，包含解析后的选项值。如果没有匹配到命令，则为空对象。
- `ignored`：一个字符串数组，包含未被解析的参数。
- `rawParsed`：包含原始解析结果的对象，包括所有参数和选项的详细信息。ParsedResult
- `mssingParameters`：一个布尔值，指示是否缺少必需的参数。

`handler` 的上下文是 `BaseContext` 的一个特化。它的 `resolved` 属性始终为 `true`，并且 `command` 属性始终为当前命令对象，`calledAs` 也始终有值。
