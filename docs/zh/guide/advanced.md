---
title: 进阶用法
---

# 进阶用法

## 传入自定义参数

Clerc 允许您传入自定义参数数组，而不是默认使用 `process.argv` / `Deno.args`。这在测试或特定环境下非常有用。

```ts
Cli().parse(["node", "my-cli", "greet"]); // 传入自定义参数数组
```

或者您也可以传入一个参数对象：

```ts
Cli().parse({
	argv: ["greet"],
});
```

## 仅解析命令，不执行

有时您可能只想解析命令和选项，而不立即执行命令处理程序。Clerc 提供了一个选项来实现这一点：

```ts
const result = Cli().parse({
	run: false, // 仅解析，不执行
});
```

在需要运行时，您可以调用：

```ts
result.run(); // 运行解析后的命令
```
