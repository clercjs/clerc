---
title: Advanced Usage
---

# Advanced Usage

## Passing Custom Arguments

Clerc allows you to pass a custom array of arguments instead of using the default `process.argv` / `Deno.args`. This is useful for testing or specific environments.

```ts
Cli().parse(["node", "my-cli", "greet"]); // Pass a custom array of arguments
```

Alternatively, you can also pass an argument object:

```ts
Cli().parse({
  argv: ["greet"],
});
```

## Parse Only Without Execution

Sometimes you may want to parse commands and flags without immediately executing the command handler. Clerc provides an option to achieve this:

```ts
const result = Cli().parse({
  run: false, // Parse only, do not execute
});
```

When you need to run, you can call:

```ts
result.run(); // Execute the parsed command
```
