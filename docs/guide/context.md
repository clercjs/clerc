---
title: Context
---

# Context

In both `handler` and `interceptor`, the first parameter received is a context object. The context keys are the same in both cases, only some values will differ.

## Types

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
  store: Partial<ContextStore>;
}
```

- `resolved`: A boolean value indicating whether a matching command was found.
- `command`: The currently parsed command object, or `undefined` if no matching command was found.
- `calledAs`: The command name the user invoked (which could be an alias).
- `parameters`: An object containing the parsed parameter values. It will be an empty object if no command was matched.
- `flags`: An object containing the parsed flag values. It will be an empty object if no command was matched.
- `ignored`: A string array containing arguments that were not parsed.
- `rawParsed`: An object containing the raw parsing result, including detailed information about all parameters and flags. ParsedResult

The context for `handler` is a specialization of `BaseContext`. Its `resolved` property is always `true`, and the `command` property is always the current command object, and `calledAs` also always has a value.
