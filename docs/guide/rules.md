---
title: Rules
---

<script setup>
import { customRules, declarativeRules } from "./rules.playground.ts";
</script>

# Rules and Constraints

Declare typed relationships across **flags** and **positional arguments** with `rules`. Instead of scattering ad-hoc `if` checks inside command handlers, a single rule definition drives runtime validation, `--help` output, shell completions, and MCP JSON Schema export.

## Declarative Primitives

Destructure the rule helpers you need inside `rules: ({ exclusive, oneOf, together, flag, arg }) => [...]`. Wrap options with `flag("...")` and positional arguments with `arg("...")` so every target is unambiguous and checked at compile time:

```ts
import { Types, clerc } from "clerc";

const cli = clerc({ name: "acme", version: "2.0.0" });

cli.command("serve [env]", {
  args: { env: Types.Enum("staging", "prod") },
  flags: {
    all: Boolean,
    json: Boolean,
    yaml: Boolean,
    tlsKey: String,
    tlsCert: String,
  },
  rules: ({ exclusive, together, oneOf, flag, arg }) => [
    exclusive(flag("json"), flag("yaml")),
    together(flag("tlsKey"), flag("tlsCert")),
    oneOf(arg("env"), flag("all")),
  ],
  run(ctx) {
    // Validated before middleware and run() execute
  },
});
```

| Primitive                   | Meaning                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `exclusive(a, b, ...)`      | At most one target may be provided.                            |
| `oneOf(a, b, ...)`          | Exactly one target must be provided.                           |
| `atLeastOne(a, b, ...)`     | At least one target must be provided.                          |
| `together(a, b, ...)`       | All targets must be provided together, or none at all.         |
| `requires(source, targets)` | Providing `source` requires all `targets` to also be provided. |

::: tip Explicit targets & compile-time safety
Passing a bare string or mistyping a flag/arg name fails at compile time. On global `cli.rules()` or commands without positional arguments, `arg` is omitted from the builder so autocomplete only offers valid flag keys.
:::

<CliPlayground :scenario="declarativeRules" lang="en" />

## Global Rules and Custom Validators

Register shared constraints across all non-`standalone` commands with `cli.rules(...)` (or `plugin().rules(...)`). For value-dependent checks, include a sync or `async` validator function that receives typed `{ args, flags, provided, terminal }` and returns an error message string (or throws `ClercError`):

```ts
const cli = clerc({ name: "acme", version: "2.0.0" })
  .flags({ json: Boolean, yaml: Boolean })
  .rules(({ exclusive, flag }) => [exclusive(flag("json"), flag("yaml"))])
  .command("listen", {
    flags: {
      port: { type: Number, short: "p", default: 3000 },
      sudo: Boolean,
    },
    rules: () => [
      ({ flags }) => {
        if (flags.port < 1024 && !flags.sudo) {
          return "ports below 1024 require --sudo";
        }
      },
    ],
    run({ flags, log }) {
      log.success(`Listening on port ${flags.port}`);
    },
  });
```

<CliPlayground :scenario="customRules" lang="en" />

## Execution Lifecycle & Ecosystem Integration

Rules run **after** flag/argument parsing, environment fallbacks, required checks, and schema conversion, and **before** middlewares and `run()`:

- **Built-in `--help` & `--version`** short-circuit before rule evaluation, so help and version output are never blocked by `oneOf` or `atLeastOne`.
- **Diagnostics**: failing rules throw `RuleError` (`code: "ERR_RULE_VIOLATION"`, exit code `2`) with the command's `usage` line attached automatically.
- **`--help`**: declarative rules render inline as option/argument tags (e.g. `[conflicts: --yaml]`, `[requires: --cert, --key]`) or on flag group headings (e.g. `MONITOR FIELDS  [at least one]`), and documented custom rules appear under `NOTES`.
- **`@clerc/plugin-completions`**: `exclusive` and `oneOf` rules hide conflicting flags and skip conflicting positional argument completions once a partner is already present.
- **`@clerc/plugin-mcp`**: declarative rules export directly to JSON Schema `dependentRequired` and `allOf` constraints on exposed tool schemas.
