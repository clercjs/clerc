---
title: Constraints
---

<script setup>
import { customChecks, flagConstraints } from "./constraints.playground.ts";
</script>

# Constraints and Checks

Compose flag relationships directly inside `flags` using `oneOf`, `exclusive`, `together`, and `atLeastOne`, and validate value-level invariants with `check`. One definition drives **TypeScript discriminated-union narrowing**, runtime validation, `--help` badges, shell completions, and MCP JSON Schemas.

## Flag Constraint Combinators

Pass combinators directly to `flags` (or inside an array `[...]` alongside plain flag objects and `group()`):

```ts
import { Types, command, exclusive, group, oneOf, together } from "clerc";

const serve = command("serve <env>", {
  args: { env: Types.Enum("staging", "prod") },
  flags: [
    oneOf(
      { token: { type: String, required: true, env: "ACME_TOKEN" } },
      { tokenFile: { type: String, required: true, env: "ACME_TOKEN_FILE" } },
    ),
    exclusive({ json: Boolean }, { yaml: Boolean }),
    group(
      "TLS Options",
      together({
        tlsKey: { type: String, required: true },
        tlsCert: { type: String, required: true },
      }),
    ),
  ],
  run(ctx) {
    // oneOf narrows tokenFile to `string` when token is undefined!
    const auth = ctx.flags.token ?? ctx.flags.tokenFile;
    //    ^?

    // together narrows tlsKey to `string` once tlsCert is checked!
    if (ctx.flags.tlsCert) {
      ctx.flags.tlsKey;
      //        ^?
    }
  },
});
```

| Combinator                         | Runtime behavior                                       | TypeScript narrowing                                        |
| ---------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| `oneOf(branch1, branch2, ...)`     | Exactly one branch must be provided.                   | Discriminated union across branches.                        |
| `exclusive(branch1, branch2, ...)` | At most one branch may be provided.                    | Discriminated union of each active branch + all-inactive.   |
| `together(flags)`                  | All flags in `flags` must be provided, or none at all. | Union of all-present and all-undefined (`false` for bools). |
| `atLeastOne(flags)`                | At least one flag in `flags` must be provided.         | Standard inferred flag types.                               |

Every combinator also accepts an optional trailing `{ message, hints }` options object to customize its error diagnostic.

<CliPlayground :scenario="flagConstraints" lang="en" />

## Cross-Field Checks (`check`)

For value-dependent invariants or rules spanning both `args` and `flags`, pass `check` on `command()`, `middleware()`, or `cli()`. A check can be a function `(ctx) => string | CheckFailure | void` (receiving `{ args, flags, provided, terminal }`) or `{ description, validate }` (whose `description` is rendered automatically under `NOTES` in `--help`):

```ts
import { cli, command, exclusive } from "clerc";

const listen = command("listen", {
  flags: {
    port: { type: Number, short: "p", default: 3000 },
    sudo: Boolean,
  },
  check: {
    description: "Ports below 1024 require --sudo",
    validate({ flags }) {
      if (flags.port < 1024 && !flags.sudo) {
        return {
          message: "ports below 1024 require '--sudo'",
          hints: [`pass '--sudo' or choose a port >= 1024`],
        };
      }
    },
  },
  run({ flags, log }) {
    log.success(`Listening on port ${flags.port}`);
  },
});

const app = cli({
  name: "acme",
  version: "2.0.0",
  flags: exclusive({ json: Boolean }, { yaml: Boolean }),
  commands: [listen],
});
```

<CliPlayground :scenario="customChecks" lang="en" />

## Execution Lifecycle & Ecosystem Integration

Constraints and `check` validators run **after** flag/argument parsing, environment fallbacks, required checks, and schema conversion, and **before** middlewares and `run()`:

- **Built-in `--help` & `--version`** short-circuit before constraint evaluation, so help and version output are never blocked by `oneOf` or `atLeastOne`.
- **Diagnostics**: violations throw `ConstraintError` (`code: "ERR_CONSTRAINT"`, exit code `2`) with automatic `env` hints and the command's `usage` line.
- **`--help`**: constraints render inline on options (`[conflicts: --yaml]`, `[with: --tls-cert]`, `[one of: ...]`) or on wrapped group headings (`TLS OPTIONS  [together]`), and `{ description, validate }` checks appear under `NOTES`.
- **`@clerc/plugin-completions`**: `exclusive` and `oneOf` hide conflicting flags once a partner is already present on the command line.
- **`@clerc/plugin-mcp`**: constraints export directly to JSON Schema `dependentRequired` and `allOf` rules on exposed tool schemas.
