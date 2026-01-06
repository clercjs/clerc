# Caveats

This document describes important behaviors and caveats of Clerc's argument parser. Understanding these behaviors is essential for building reliable CLI applications and avoiding unexpected issues.

## Non-Greedy Parsing

::: warning Important
The Clerc parser is **non-greedy**. It only reads arguments **before the first flag** to determine which command to execute.
:::

### Why Non-Greedy?

Clerc uses non-greedy parsing for the following reasons:

1. **Predictable behavior**: Flags can appear anywhere after the command without affecting command resolution
2. **Compatibility**: This matches the behavior of most Unix CLI tools
3. **Flexibility**: Allows flags to be placed in any order after the command
4. **Simplicity**: Makes the parsing logic straightforward and easier to understand

### How It Works

When parsing command-line arguments, the parser follows this logic:

1. Read arguments from left to right
2. Stop reading command/subcommand tokens when encountering the first flag (starting with `-` or `--`)
3. Everything after the first flag is treated as flags and their values, or as parameters

### Examples

```bash
# Command is "build", --verbose is a flag
cli build --verbose

# Command is "build", --help is a flag, "foo" is a parameter (NOT a subcommand)
cli build --help foo

# NO command is matched! --help is encountered first, so "build" becomes a parameter
cli --help build

# Command is "deploy staging", --force is a flag
cli deploy staging --force

# Command is "deploy", --env is a flag, "staging" is a parameter (NOT a subcommand)
cli deploy --env staging
```

### Impact on Plugins

This non-greedy behavior affects how certain plugins work:

#### Help Plugin

The `--help` flag shows CLI help **only when** it immediately follows the CLI name with no additional arguments:

```bash
# ✅ Shows CLI help (--help immediately follows cli, no extra arguments)
cli --help

# ✅ Shows help for "build" command (command comes before --help)
cli build --help

# ❌ Throws error!
cli --help build
```

::: warning

`cli --help build` will throw an error because:

1. The parser encounters `--help` first, so no command is matched (tries to match root command)
2. No root command is registered
3. Therefore, an error is thrown

The key difference:

- `cli --help` → Help plugin intercepts and shows CLI help
- `cli --help build` → Tries to execute root command (which doesn't exist), throws error

:::

If you want to show help for a specific command, always place the command name **before** the `--help` flag:

```bash
# ✅ Correct: Shows help for "build"
cli build --help
```

Alternatively, use the `help` command:

```bash
# ✅ Always shows help for "build"
cli help build
```

#### Version Plugin

Similarly, for version flags:

```bash
# Shows version (no command matched)
cli --version

# Command "build" is matched, but --version flag may be ignored by the command
cli build --version
```

## Parsing Order

The parser processes arguments in the following order:

1. **Command Resolution**: Identify the command from arguments before the first flag
2. **Flag Parsing**: Parse all flags (both global and command-specific)
3. **Parameter Collection**: Remaining non-flag arguments become parameters
4. **Double Dash Handling**: Everything after `--` is collected as-is

### Double Dash (`--`)

The double dash `--` is a special marker that tells the parser to stop interpreting flags:

```bash
# "--foo" is passed as a parameter, not parsed as a flag
cli build -- --foo --bar
```

## Flag Value Resolution

Flags can receive values in multiple ways:

```bash
# Space-separated
cli build --output dist

# Equals sign
cli build --output=dist

# Colon (useful when value contains =)
cli build --define:KEY=VALUE
```

## Dot-Notation for Object Flags

For flags with `type: Object`, you can use dot notation to set nested values:

```bash
# Sets config.port to "8080"
cli --config.port 8080

# Sets config.server.host to "localhost"
cli --config.server.host localhost
```

### Boolean Value Handling

For dot-notation flags, special values are automatically converted:

| Input                         | Result               |
| ----------------------------- | -------------------- |
| `--config.enabled true`       | `{ enabled: true }`  |
| `--config.enabled false`      | `{ enabled: false }` |
| `--config.enabled` (no value) | `{ enabled: true }`  |
| `--config.enabled=true`       | `{ enabled: true }`  |
| `--config.enabled=false`      | `{ enabled: false }` |
| `--config.enabled=` (empty)   | `{ enabled: true }`  |

The conversion rules are:

- `"true"` or empty string → `true`
- `"false"` → `false`
- Other values remain as strings

::: warning Path Conflicts

When a path has already been set to a primitive value, subsequent nested paths will be **silently ignored**:

```bash
# --config.port.internal is ignored because config.port is already "8080"
cli --config.port 8080 --config.port.internal 9090
# Result: { config: { port: "8080" } }
```

To avoid this, ensure your paths don't conflict (i.e., don't set both `a.b` and `a.b.c`).

:::

### Default Values for Object Flags

::: warning Not Recommended

**We do not recommend using `default` values with Object flags that use dot-notation.**

:::

Object flags follow an **all-or-nothing** default behavior:

- If **no** dot-notation values are provided for the flag, the `default` value is used entirely
- If **any** dot-notation value is provided, the `default` is completely ignored (no merging)

```bash
# Example: env flag with default { NODE_ENV: "development", PORT: "3000" }

# No --env flags provided → Uses entire default
cli build
# Result: { NODE_ENV: "development", PORT: "3000" }

# Any --env flag provided → Default is completely ignored
cli build --env.PORT 8080
# Result: { PORT: "8080" }  ← NODE_ENV is NOT included!
```

#### Why Not Use Defaults with Dot-Notation?

Dot-notation is designed for **user-defined, runtime configuration values** (like environment variables, define macros, etc.) where:

- The keys are not known in advance
- Users specify exactly what they need
- There's no "standard set" of expected keys

This semantic mismatch with defaults causes several issues:

1. **Complex merge logic**: Shallow merge? Deep merge? User-configurable merge function? Each approach adds complexity
2. **Type inference complexity**: Merging object types requires intersection types and sophisticated type-level logic
3. **Unexpected behavior**: Users might expect `default` to act as "fallback values" for missing keys, but implementing this is non-trivial

#### Recommended Approach

Instead of using defaults with dot-notation, handle default values in your command handler:

```typescript
.command('build', 'Build the project')
.flags({
  env: Object,
})
.on((context) => {
  const env = {
    NODE_ENV: 'development',
    PORT: '3000',
    ...context.flags.env,  // User-provided values override defaults
  };

  // Use env...
});
```

This gives you full control over the merge logic and keeps type inference simple.

## Short Flag Combinations

Short flags can be combined:

```bash
# Equivalent to: -a -b -c
cli -abc

# -a and -b are boolean flags, -c takes "value"
cli -abc value
```

## Best Practices

1. **Place commands before flags**: Always write `cli command --flag` instead of `cli --flag command`

2. **Use explicit help command**: When in doubt, use `cli help command` instead of `cli --help command`

3. **Quote special characters**: Use quotes for values containing spaces or special characters

4. **Use `--` for pass-through arguments**: When passing arguments to child processes, use `--` to prevent parsing

```bash
# Pass "--watch" to the underlying tool, not to cli
cli build -- --watch
```
