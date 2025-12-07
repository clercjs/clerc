# Clerc 重构方案 v3

## 核心目标

1.  **构建独立解析器**: 创建一个全新的 `@clerc/parser` 包。该包基于 `minimist`，功能独立，可脱离 `@clerc/core` 使用。
2.  **替换旧解析器**: 在 `@clerc/core` 中集成新的 `@clerc/parser`，并彻底移除 `type-flag` 依赖。
3.  **简化核心**: 重构 Clerc 核心代码，移除 `hasRootOrAlias`，`hasRoot` 和 `otherMethodCalled` 等内部实现细节。

---

## 第一阶段: 设计并实现独立的 `@clerc/parser`

### 1.1: 创建包结构

- **位置**: `packages/parser`
- **文件**: `package.json` (依赖 `minimist`), `tsdown.config.ts`, `src/index.ts`, `src/types.ts`。

### 1.2: 定义内部类型

- **文件**: `packages/parser/src/types.ts`
- **目的**: 定义解析器自身的、独立的类型，不依赖于 `@clerc/core`。
- **核心类型**:
  - `FlagOption`: 定义单个 flag 的配置（`type`, `alias`, `description`）。
  - `ParserOptions`: 定义解析器的整体配置，主要是 `flags: Record<string, FlagOption>`。
  - `ParsedResult`: 定义解析的返回结果（`flags`, `unknownFlags`, `_`）。

### 1.3: 实现解析器 API

- **文件**: `packages/parser/src/index.ts`
- **API**: `export function createParser(options: ParserOptions)`
- **返回值**: 返回一个对象，包含 `parse(argv: string[]): ParsedResult` 方法。
- **内部逻辑**:
  1.  将 `ParserOptions` 转换为 `minimist` 的配置。
  2.  调用 `minimist` 执行解析。
  3.  根据 `ParserOptions` 分离已知和未知 flags。
  4.  返回 `ParsedResult` 格式的对象。

---

## 第二阶段: 集成新解析器并移除旧依赖

### 2.1: 在 `@clerc/core` 中集成

- **文件**: `packages/core/src/cli.ts`
- **操作**:
  1.  添加 `@clerc/parser` 依赖。
  2.  **创建适配器**: 在 `#getContext` 方法中，实现一个转换函数，将 `@clerc/core` 内部的 `flags` 对象格式转换为 `@clerc/parser` 所需的 `ParserOptions` 格式。
  3.  **替换解析调用**: 使用 `createParser(adapter(...)).parse(...)` 来替换 `typeFlag(...)`。

### 2.2: 清理依赖

- 从 `packages/core/package.json` 中移除 `type-flag`。
- 更新 `pnpm-lock.yaml`。

---

## 第三阶段: 简化 Clerc 核心 (在阶段二完成后)

### 3.1: 移除 `otherMethodCalled`

- **文件**: `packages/core/src/cli.ts`
- **操作**: 删除 `#isOtherMethodCalled` 属性、`#otherMethodCalled()` 方法及其所有调用。

### 3.2: 移除 `hasRoot` 和 `hasRootOrAlias`

- **文件**: `packages/core/src/cli.ts`, `packages/core/src/types/index.ts`
- **操作**: 从 `Clerc` 类和 `HandlerContext` 类型中移除这两个属性。

### 3.3: 更新 `plugin-help`

- **文件**: `packages/plugin-help/src/index.ts`
- **操作**: 将 `ctx.hasRoot` 等判断逻辑修改为直接检查 `ctx.cli._commands`。
