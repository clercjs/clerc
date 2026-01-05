---
title: Types
---

# Types

Types allow you to validate, convert, and parse values for both flags and parameters. Clerc provides several built-in type functions and supports custom types.

## Built-in Basic Types

Clerc supports the standard JavaScript type constructors for common use cases:

- **String**: For string values (default value: `undefined`)
- **Number**: For numeric values (can be used directly)
- **Boolean**: For boolean switches (default value: `false`)
- **Object**: For key-value pairs (default value: `{}`)

### String Type

The `String` type is used for flags and parameters that accept string values. This is the most basic type.

**Default value behavior:** If not specified, its value is `undefined` (unless a `default` property is set).

```ts
const cli = Cli()
  .command("greet", "Greet someone", {
    flags: {
      name: {
        type: String,
        description: "User name",
        default: "World",
      },

      message: {
        type: String,
        short: "m",
        description: "Greeting message",
      },
    },
  })
  .on("greet", (ctx) => {
    console.log(`${ctx.flags.message}, ${ctx.flags.name}!`);
    // $ node cli.mjs greet --name John --message Hello
    // Hello, John!
    // $ node cli.mjs greet --message Hello
    // ctx.flags.message => "Hello"
    // ctx.flags.name => "World" (uses default value)
  })
  .parse();
```

### Boolean Type

The `Boolean` type is used for creating boolean switch flags. By default, simply mentioning the flag name sets it to `true`.

**Default value behavior:** If the flag is not specified, its value is `false`.

```ts
const cli = Cli()
  .command("build", "Build the project", {
    flags: {
      production: {
        type: Boolean,
        description: "Build for production",
      },

      watch: {
        type: Boolean,
        short: "w",
        description: "Enable watch mode",
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

#### Boolean's Negatable Property

The Boolean type supports a `negatable` property that allows you to decide whether to enable negated flags. By default, `negatable` is `true`, which means `--no-flag` will set the `flag` flag to `false`.

```ts
const cli = Cli()
  .command("start", "Start the application", {
    flags: {
      color: {
        type: Boolean,
        negatable: true, // default
        description: "Enable color output",
        default: true,
      },

      cache: {
        type: Boolean,
        negatable: false, // disable negation form
        description: "Enable caching",
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

    // You must use --cache=false to disable caching
    // $ node cli.mjs start --cache=false
    ctx.flags.cache; // => false
  })
  .parse();
```

### Array Type

The `Array` type is used for flags and parameters that accept multiple values. Define it by wrapping the type function in an array:

**Default value behavior:** If not specified, its value is `[]` (empty array).

```ts
const cli = Cli()
  .command("copy", "Copy files", {
    flags: {
      // Use [String] to accept multiple string values
      include: {
        type: [String],
        short: "i",
        description: "File patterns to include",
      },

      // Use [Number] to accept multiple numeric values
      ports: {
        type: [Number],
        short: "p",
        description: "Ports to listen on",
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

### Counter Type

The counter type is used to count how many times a flag is specified. This can be implemented by using the `[Boolean]` type:

**Default value behavior:** If not specified, its value is `0`.

```ts
const cli = Cli()
  .command("log", "Display logs", {
    flags: {
      // [Boolean] type counts how many times the flag is used
      verbose: {
        type: [Boolean],
        short: "v",
        description: "Verbosity level (-v, -vv, -vvv)",
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

### Object Type

The `Object` type is used for flags that accept key-value pairs. Use dots or other delimiters to specify object properties:

**Default value behavior:** If not specified, its value is `{}` (empty object).

```ts
const cli = Cli()
  .command("config", "Configure the application", {
    flags: {
      define: {
        type: Object,
        short: "d",
        description: "Define environment variables",
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

If you want to pass key-value pairs like `K=V`, you can use the colon delimiter in the command line:

```bash
$ node cli.mjs config --define:env=production --define:version=1.0.0
```

Actually, `--define=env=production` also works fine, it's just not as intuitive.

:::

#### Advanced Object Type with `objectType()`

For more control over object flag parsing, type conversion, and default value merging, you can use the `objectType()` function from `@clerc/parser`:

```ts
import { coerceObjectValue, objectType, setDotValues } from "@clerc/parser";

// or import { objectType, setDotValues, coerceObjectValue } from "clerc";

const cli = Cli()
  .command("dev", "Start development server", {
    flags: {
      env: {
        type: objectType<{ PORT?: number; DEBUG?: boolean; HOST?: string }>({
          setValue: (object, path, value) => {
            // Custom type conversion based on field name
            if (path === "PORT") {
              setDotValues(object, path, Number(value));
            } else if (path === "DEBUG") {
              setDotValues(object, path, value === "true");
            } else {
              // For other fields, use default coercion
              setDotValues(object, path, coerceObjectValue(value));
            }
          },
        }),
        default: { PORT: 3000, HOST: "0.0.0.0" }, // Default values
      },
    },
  })
  .on("dev", (ctx) => {
    // $ node cli.mjs dev --env.PORT 8080 --env.DEBUG true
    ctx.flags.env.PORT; // => 8080 (number)
    ctx.flags.env.DEBUG; // => true (boolean)
    ctx.flags.env.HOST; // => "0.0.0.0" (merged from default)
  })
  .parse();
```

**Key features:**

1. **Type-safe generic support**: Specify the expected object structure with `objectType<T>()`
2. **Custom value transformation**: The `setValue` function receives:
   - `object`: The current object being built
   - `path`: The dot-separated path (e.g., `"PORT"` or `"foo.bar"`)
   - `value`: The raw CLI string value
3. **Automatic default merging**: When you provide a `default` value in the flag config, it automatically merges with user-provided values (shallow merge by default)
4. **Helper functions**: Use `setDotValues`, `appendDotValues`, and `coerceObjectValue` for common operations

**Default behavior (without custom `setValue`):**

```ts
import { objectType } from "@clerc/parser";

// or import { objectType } from "clerc";

const cli = Cli()
  .command("config", "Configure settings", {
    flags: {
      settings: {
        type: objectType(), // Uses default behavior
        default: { theme: "dark", language: "en" },
      },
    },
  })
  .on("config", (ctx) => {
    // $ node cli.mjs config --settings.name app --settings.version 1.0.0
    ctx.flags.settings; // => { name: "app", version: "1.0.0", theme: "dark", language: "en" }

    // $ node cli.mjs config --settings.tags a --settings.tags b
    ctx.flags.settings; // => { tags: ["a", "b"], theme: "dark", language: "en" }
    // Duplicate keys become arrays, default values are merged
  })
  .parse();
```

The default behavior automatically:

- Converts `"true"` or empty values to boolean `true`
- Converts `"false"` to boolean `false`
- Handles duplicate keys by creating arrays
- **Merges external `default` values** with user-provided values (shallow merge)

**Context-aware transformations:**

```ts
import { coerceObjectValue, objectType, setDotValues } from "@clerc/parser";

// or import { coerceObjectValue, objectType, setDotValues } from "clerc";

const cli = Cli()
  .command("deploy", "Deploy application", {
    flags: {
      config: {
        type: objectType({
          setValue: (object, path, value) => {
            // Conditional logic based on other fields
            if (path === "debug") {
              // Disable debug in production mode
              if (object.mode === "production") {
                setDotValues(object, path, false);
              } else {
                setDotValues(object, path, coerceObjectValue(value));
              }
            } else {
              setDotValues(object, path, coerceObjectValue(value));
            }
          },
        }),
        default: { mode: "development", timeout: 30 },
      },
    },
  })
  .on("deploy", (ctx) => {
    // $ node cli.mjs deploy --config.mode production --config.debug true
    ctx.flags.config; // => { mode: "production", debug: false, timeout: 30 }
    // Debug is forced to false in production, timeout is merged from default
  })
  .parse();
```

**Custom merge logic:**

By default, `objectType` performs a shallow merge when combining default values with user-provided values. You can customize this behavior with the `mergeObject` option:

```ts
import { objectType } from "@clerc/parser";

const cli = Cli()
  .command("start", "Start the server", {
    flags: {
      config: {
        type: objectType({
          mergeObject: (target, defaults) => {
            // Custom merge logic: deep merge nested objects
            for (const [key, val] of Object.entries(defaults)) {
              if (
                typeof val === "object" &&
                val !== null &&
                typeof target[key] === "object"
              ) {
                // Deep merge nested objects
                Object.assign(target[key], val, target[key]);
              } else if (!(key in target)) {
                // Add missing keys from defaults
                target[key] = val;
              }
            }
          },
        }),
        default: { db: { host: "localhost", port: 5432 }, cache: { ttl: 300 } },
      },
    },
  })
  .on("start", (ctx) => {
    // $ node cli.mjs start --config.db.host example.com
    ctx.flags.config;
    // => { db: { host: "example.com", port: 5432 }, cache: { ttl: 300 } }
    // Deep merge preserves db.port from default
  })
  .parse();
```

**Utility functions:**

- `setDotValues(object, path, value)`: Sets a value at a nested path (overwrites existing values)
- `appendDotValues(object, path, value)`: Sets a value at a nested path (converts duplicates to arrays)
- `coerceObjectValue(value)`: Default boolean coercion (`"true"` → `true`, `"false"` → `false`)

:::tip

The `objectType()` function provides a more powerful and type-safe alternative to the basic `Object` type, especially when you need:

- Custom type conversions per field
- Context-aware transformations
- Better TypeScript type inference
- Integration with schema validation libraries

:::

## Built-in Advanced Types

Clerc provides some built-in advanced type functions to facilitate common needs:

- `Enum`: Restrict flag and parameter values to a predefined set.
- `Range`: Restrict numeric values to a specific range and convert to numbers.
- `Regex`: Validate values against a regular expression pattern.

These type functions can be used for both flags and parameters, allowing you to share the same type definitions across your CLI:

```ts
import { Types } from "clerc";

Cli()
  .command("serve", "Start the server", {
    flags: {
      mode: {
        type: Types.Enum("development", "production", "test"),
        default: "development" as const,
        description: "Set the application mode",
      },
    },
    parameters: [
      {
        key: "[port]",
        type: Types.Range(1024, 65_535),
        description: "Port number",
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

### Enum Type

Restrict flag or parameter values to a predefined set of options:

```ts
import { Types } from "clerc";

const cli = Cli()
  .scriptName("build-cli")
  .description("Build tool")
  .version("1.0.0")
  .command("config", "Configure build settings", {
    flags: {
      format: {
        type: Types.Enum("json", "yaml", "toml"),
        description: "Output format",
      },
    },
    parameters: [
      {
        key: "<setting>",
        type: Types.Enum("output", "target", "format"),
        description: "Setting name",
      },
      {
        key: "<value>",
        description: "Setting value",
      },
    ],
  })
  .on("config", (ctx) => {
    console.log(`Setting ${ctx.parameters.setting} = ${ctx.parameters.value}`);
  })
  .parse();
```

Usage:

```bash
$ build-cli config --format json output dist
$ build-cli config --format yaml target es2020
$ build-cli config --format invalid value
# Error: Invalid value: invalid. Must be one of: json, yaml, toml
```

### Range Type

Restrict numeric values to a specific range and convert to numbers:

```ts
import { Types } from "clerc";

const cli = Cli()
  .scriptName("server-cli")
  .description("Server management tool")
  .version("1.0.0")
  .command("start", "Start the server", {
    flags: {
      port: {
        type: Types.Range(1024, 65_535),
        description: "Port number",
      },
    },
    parameters: [
      {
        key: "[timeout]",
        type: Types.Range(1, 3600),
        description: "Timeout in seconds",
      },
    ],
  })
  .on("start", (ctx) => {
    const port = ctx.flags.port ?? 3000;
    console.log(`Starting server on port ${port}`);
  })
  .parse();
```

Usage:

```bash
$ server-cli start --port 3000
$ server-cli start --port 8080
$ server-cli start --port 100
# Error: Invalid value: 100. Must be a number between 1024 and 65535
```

### Regex Type

Validate values against a regular expression pattern:

```ts
import { Types } from "clerc";

const cli = Cli()
  .scriptName("git-clone")
  .description("Clone repository")
  .version("1.0.0")
  .command("clone", "Clone a repository", {
    parameters: [
      {
        key: "<repo>",
        type: Types.Regex(/^[\w\-.]+\/[\w\-.]+$/, "owner/repo format"),
        description: "Repository in owner/repo format",
      },
    ],
  })
  .on("clone", (ctx) => {
    console.log(`Cloning ${ctx.parameters.repo}`);
  })
  .parse();
```

Usage:

```bash
$ git-clone clone clercjs/clerc
$ git-clone clone myorg/myrepo
$ git-clone clone invalid
# Error: Invalid value: invalid. Must match: owner/repo format
```

## Custom Types

You can create custom type functions by providing a function that accepts a string argument and returns the parsed value.

### Type Display Property

Custom type functions can include an optional `display` property that provides a user-friendly name for the type in help output. This is especially useful for complex types where the function name doesn't clearly describe what the type accepts.

```ts
// Custom type function that parses a comma-separated string into an array of strings
const CommaSeparatedList = (value: string): string[] =>
  value.split(",").map((item) => item.trim());

// Add a display property for better help documentation
CommaSeparatedList.display = "item1,item2,...";

const cli = Cli()
  .scriptName("custom-cli")
  .description("A CLI using a custom type")
  .version("1.0.0")
  .command("list", "Display list", {
    flags: {
      items: {
        type: CommaSeparatedList,
        default: [] as string[],
        description: "Comma-separated list of strings",
      },
    },
  })
  .on("list", (ctx) => {
    console.log("Items:", ctx.flags.items);
    //                              ^?
  })
  .parse();
```

The `display` property is used by the help system to show a more descriptive type name instead of the function name. For example, instead of showing "CommaSeparatedList" in the help output, it would show "item1,item2,...".

### Basic Custom Type Example

```ts
// Custom type function that parses a comma-separated string into an array of strings
const CommaSeparatedList = (value: string): string[] =>
  value.split(",").map((item) => item.trim());

const cli = Cli()
  .scriptName("custom-cli")
  .description("A CLI using a custom type")
  .version("1.0.0")
  .command("list", "Display list", {
    flags: {
      items: {
        type: CommaSeparatedList,
        default: [] as string[],
        description: "Comma-separated list of strings",
      },
    },
  })
  .on("list", (ctx) => {
    console.log("Items:", ctx.flags.items);
    //                              ^?
  })
  .parse();
```

Custom type functions can also be used with array syntax to accept multiple values:

```ts
const cli = Cli()
  .command("process", "Process files", {
    flags: {
      // Use [CommaSeparatedList] to accept multiple comma-separated lists
      patterns: {
        type: [CommaSeparatedList],
        short: "p",
        description: "File patterns (comma-separated)",
      },
    },
  })
  .on("process", (ctx) => {
    // $ node cli.mjs process -p "*.js,*.ts" -p "src/**"
    ctx.flags.patterns; // => [["*.js", "*.ts"], ["src/**"]]
  })
  .parse();
```

### Using Custom Types with Parameters

Custom type functions with display properties can also be used for parameters, providing better help documentation:

```ts
// Custom type function for parsing version numbers
function Version(value: string): string {
  if (!/^\d+\.\d+\.\d+$/.test(value)) {
    throw new Error(`Invalid version format: ${value}. Expected format: x.y.z`);
  }

  return value;
}

// Add display property for help documentation
Version.display = "x.y.z";

const cli = Cli()
  .scriptName("release-cli")
  .description("Release management tool")
  .version("1.0.0")
  .command("publish", "Publish a new version", {
    parameters: [
      {
        key: "<version>",
        type: Version,
        description: "Version number to publish",
      },
      {
        key: "[channel]",
        type: Types.Enum("stable", "beta", "alpha"),
        description: "Release channel",
      },
    ],
  })
  .on("publish", (ctx) => {
    console.log(
      `Publishing version ${ctx.parameters.version} to ${ctx.parameters.channel || "stable"} channel`,
    );
  })
  .parse();
```

In the help output, instead of showing "Version" as the type, it will show "x.y.z", making it clearer what format is expected.
