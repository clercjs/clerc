---
title: Error Handling
---

<script setup>
import { clercError, typoSuggestions } from "./errors.playground.ts";
</script>

# Error Handling

Parse, validation, and constraint errors exit with code `2` (usage error) and automatically attach the command's `usage` line and `--help` hint. Schema configuration errors (`InvalidSchemaError`) and runtime/domain `ClercError` instances exit with code `1`. For unknown commands, flags, and enum values, Clerc suggests the closest match.

## Typo Suggestions

<CliPlayground :scenario="typoSuggestions" lang="en" />

## Built-in Error Classes

Every built-in error extends `ClercError` and carries a machine-readable `code` and `exitCode`:

| Error Class                    | `code`                    | `exitCode` | When thrown                                                                       |
| ------------------------------ | ------------------------- | ---------- | --------------------------------------------------------------------------------- |
| `UnknownCommandError`          | `ERR_UNKNOWN_COMMAND`     | `2`        | Subcommand does not match any command or alias (includes typo hint).              |
| `NoCommandError`               | `ERR_NO_COMMAND`          | `2`        | Invoked without a command when `help: false` and no root `run`.                   |
| `UnknownFlagError`             | `ERR_UNKNOWN_FLAG`        | `2`        | Unrecognized flag under `strictFlags: true` (includes typo hint).                 |
| `MissingRequiredFlagError`     | `ERR_MISSING_FLAG`        | `2`        | Required flag missing from both argv and `env`.                                   |
| `MissingFlagValueError`        | `ERR_MISSING_FLAG_VALUE`  | `2`        | Value flag passed without a value (suggests `--flag=-val` if dash).               |
| `MissingRequiredArgumentError` | `ERR_MISSING_ARGUMENT`    | `2`        | Required positional `<arg>` missing from argv and `env`.                          |
| `UnexpectedArgumentError`      | `ERR_UNEXPECTED_ARGUMENT` | `2`        | Extra positional arguments beyond the command signature.                          |
| `ValidationError`              | `ERR_VALIDATION`          | `2`        | Schema, constructor, or array bound (`unique`/`minItems`/`maxItems`) failure.     |
| `ConstraintError`              | `ERR_CONSTRAINT`          | `2`        | Flag combinator (`oneOf`/`exclusive`/`together`/`atLeastOne`) or `check` failure. |
| `InvalidSchemaError`           | `ERR_INVALID_SCHEMA`      | `1`        | Authoring mistake detected while compiling commands, flags, or args.              |
| `ClercError`                   | `ERR_CLI` (default)       | `1`        | Custom domain or application errors thrown from handlers.                         |

## Throwing `ClercError`

Throw `ClercError` in your own commands to render matching diagnostics with `code`, `exitCode`, `detail`, `hints`, `usage`, and `cause`:

```ts
import { ClercError, cli, command } from "clerc";

const publish = command("publish", {
  run() {
    throw new ClercError("not logged in to registry", {
      code: "ERR_AUTH",
      exitCode: 1,
      detail: "No token found in ~/.acmerc or ACME_TOKEN",
      usage: "acme login --registry https://registry.example.com",
    }).addHint("run 'acme login' first or set ACME_TOKEN");
  },
});

const app = cli({
  name: "acme",
  version: "1.0.0",
  commands: [publish],
});
```

<CliPlayground :scenario="clercError" lang="en" />

::: tip Stack traces & clean exits

- Set `DEBUG=1` in the environment or pass `-v` / `--verbose` to include full error stack traces in rendered diagnostics.
- When a command wants to stop with a custom exit code **without** printing an error block or invoking `onError`, call `ctx.exit(code)` instead. See [Context & Terminal](/guide/context#clean-early-exits-ctx-exit).
  :::

## Custom `onError` Handlers

Pass `onError(err, ctx)` on `cli()`, `middleware()`, or `command()` to intercept errors in reverse registration (LIFO) order—command-level handlers run first, then inner-to-outer middleware handlers, then the root `cli` handler. Returning `true` marks the error as handled and suppresses default diagnostic printing:

```ts
import { cli } from "clerc";

const app = cli({
  name: "acme",
  version: "1.0.0",
  onError(err, ctx) {
    ctx.log.error("Unhandled failure", Error.isError(err) ? err.message : err);

    return true;
  },
});
```

You can also format any error manually using the exported `formatDiagnostic(error, { theme, name, commandPath, verbose, showHelpHint })` helper.
