# 注意事项

本文档描述 Clerc 参数解析器的重要行为和注意事项。理解这些行为对于构建可靠的 CLI 应用程序和避免意外问题至关重要。

## 非贪婪解析

::: warning 重要
Clerc 解析器是**非贪婪的**。它只读取**第一个标志之前**的参数来确定要执行哪个命令。
:::

### 为什么采用非贪婪解析？

Clerc 采用非贪婪解析有以下原因：

1. **可预测的行为**：标志可以出现在命令之后的任何位置，不会影响命令解析
2. **兼容性**：这与大多数 Unix CLI 工具的行为一致
3. **灵活性**：允许标志在命令之后以任意顺序放置
4. **简单性**：使解析逻辑简单直接，更容易理解

### 工作原理

解析命令行参数时，解析器遵循以下逻辑：

1. 从左到右读取参数
2. 遇到第一个标志（以 `-` 或 `--` 开头）时停止读取命令/子命令标记
3. 第一个标志之后的所有内容都被视为标志及其值，或作为参数

### 示例

```bash
# 命令是 "build"，--verbose 是标志
cli build --verbose

# 命令是 "build"，--help 是标志，"foo" 是参数（不是子命令）
cli build --help foo

# 没有匹配到命令！因为首先遇到了 --help，所以 "build" 变成了参数
cli --help build

# 命令是 "deploy staging"，--force 是标志
cli deploy staging --force

# 命令是 "deploy"，--env 是标志，"staging" 是参数（不是子命令）
cli deploy --env staging
```

### 对插件的影响

这种非贪婪行为会影响某些插件的工作方式：

#### Help 插件

`--help` 标志**只有在**紧跟 CLI 名称且没有额外参数时，才会显示 CLI 帮助：

```bash
# ✅ 显示 CLI 帮助（--help 紧跟在 cli 后面，没有额外参数）
cli --help

# ✅ 显示 "build" 命令的帮助（命令在 --help 之前）
cli build --help

# ❌ 抛出错误！
cli --help build
```

::: warning

`cli --help build` 会抛出错误，因为：

1. 解析器首先遇到 `--help`，所以没有匹配到命令（尝试匹配根命令）
2. 没有注册根命令
3. 因此抛出错误

关键区别：

- `cli --help` → Help 插件拦截并显示 CLI 帮助
- `cli --help build` → 尝试执行根命令（不存在），抛出错误

:::

如果要显示特定命令的帮助，请始终将命令名称放在 `--help` 标志**之前**：

```bash
# ✅ 正确：显示 "build" 的帮助
cli build --help
```

或者，使用 `help` 命令：

```bash
# ✅ 始终显示 "build" 的帮助
cli help build
```

#### Version 插件

同样，对于版本标志：

```bash
# 显示版本（没有匹配到命令）
cli --version

# 匹配到 "build" 命令，但 --version 标志可能被该命令忽略
cli build --version
```

## 解析顺序

解析器按以下顺序处理参数：

1. **命令解析**：从第一个标志之前的参数中识别命令
2. **标志解析**：解析所有标志（全局标志和命令特定标志）
3. **参数收集**：剩余的非标志参数成为参数
4. **双横线处理**：`--` 之后的所有内容按原样收集

### 双横线（`--`）

双横线 `--` 是一个特殊标记，告诉解析器停止解释标志：

```bash
# "--foo" 作为参数传递，不会被解析为标志
cli build -- --foo --bar
```

## 标志值解析

标志可以通过多种方式接收值：

```bash
# 空格分隔
cli build --output dist

# 等号
cli build --output=dist

# 冒号（当值包含 = 时很有用）
cli build --define:KEY=VALUE
```

## 对象标志的点表示法

对于 `type: Object` 的标志，可以使用点表示法设置嵌套值：

```bash
# 将 config.port 设置为 "8080"
cli --config.port 8080

# 将 config.server.host 设置为 "localhost"
cli --config.server.host localhost
```

### 布尔值处理

对于点表示法标志，特殊值会被自动转换：

| 输入                        | 结果                 |
| --------------------------- | -------------------- |
| `--config.enabled true`     | `{ enabled: true }`  |
| `--config.enabled false`    | `{ enabled: false }` |
| `--config.enabled`（无值）  | `{ enabled: true }`  |
| `--config.enabled=true`     | `{ enabled: true }`  |
| `--config.enabled=false`    | `{ enabled: false }` |
| `--config.enabled=`（空值） | `{ enabled: true }`  |

转换规则：

- `"true"` 或空字符串 → `true`
- `"false"` → `false`
- 其他值保持为字符串

::: warning 路径冲突

当一个路径已经被设置为原始值时，后续的嵌套路径会被**静默忽略**：

```bash
# --config.port.internal 被忽略，因为 config.port 已经是 "8080"
cli --config.port 8080 --config.port.internal 9090
# 结果：{ config: { port: "8080" } }
```

为避免这种情况，请确保路径不会冲突（即不要同时设置 `a.b` 和 `a.b.c`）。

:::

## 短标志组合

短标志可以组合使用：

```bash
# 等同于：-a -b -c
cli -abc

# -a 和 -b 是布尔标志，-c 接收 "value"
cli -abc value
```

## 最佳实践

1. **将命令放在标志之前**：始终写 `cli command --flag` 而不是 `cli --flag command`

2. **使用显式的 help 命令**：如有疑问，使用 `cli help command` 而不是 `cli --help command`

3. **引用特殊字符**：对包含空格或特殊字符的值使用引号

4. **使用 `--` 传递参数**：将参数传递给子进程时，使用 `--` 防止解析

```bash
# 将 "--watch" 传递给底层工具，而不是传递给 cli
cli build -- --watch
```
