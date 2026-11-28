---
title: Testing
---

<script setup>
import { inspectModel, memoryTerminal } from "./testing.playground.ts";
</script>

# Testing

Clerc never hard-codes `process.argv`, `process.env`, `process.stdout`, or `process.exit()` inside its execution core. Every CLI can be exercised in memory in a few milliseconds.

## Testing with `createMemoryTerminal()`

`createMemoryTerminal()` creates an isolated in-memory `Terminal` with configurable `env`, `cwd`, `isTTY`, `color`, `unicode`, and `columns`, plus helpers to read captured `stdoutText()` and `stderrText()`:

```ts
import { Types, cli, command, createMemoryTerminal } from "clerc";
import { expect, test } from "vitest";

const deploy = command("deploy <env>", {
  args: { env: Types.Enum("staging", "prod") },
  flags: {
    token: { type: String, required: true, env: "ACME_TOKEN" },
  },
  run(ctx) {
    ctx.log.success(`Deployed to ${ctx.args.env}`);
  },
});

const app = cli({
  name: "acme",
  version: "2.0.0",
  commands: [deploy],
});

test("deploys using env token and rejects invalid enum", async () => {
  const terminal = createMemoryTerminal({
    env: { ACME_TOKEN: "secret_123" },
  });

  const ok = await app.run(["deploy", "staging"], { terminal });
  expect(ok.ok).toBe(true);
  expect(ok.exitCode).toBe(0);
  expect(terminal.stdoutText()).toContain("Deployed to staging");

  terminal.clear();
  const bad = await app.run(["deploy", "qa"], { terminal });
  expect(bad.ok).toBe(false);
  expect(bad.exitCode).toBe(2);
  expect(terminal.stderrText()).toContain("expected one of: 'staging', 'prod'");
});
```

<CliPlayground :scenario="memoryTerminal" lang="en" />

## Asserting Error Instances (`throwOnError`)

When a test wants to assert the specific `ClercError` subclass rather than rendered `stderr` text, pass `throwOnError: true`:

```ts
import type { Cli } from "clerc";
import { createMemoryTerminal } from "clerc";
import { expect } from "vitest";
declare const app: Cli;
// ---cut---
import { MissingRequiredFlagError } from "clerc";

await expect(
  app.run(["deploy", "prod"], {
    terminal: createMemoryTerminal(),
    throwOnError: true,
  }),
).rejects.toThrow(MissingRequiredFlagError);
```

## Inspecting the Compiled `CliModel`

Call `app.buildModel()` to obtain the immutable `CliModel` (`meta`, `tree`, `globalFlags`, `groups`). Useful for generating custom documentation, man pages, or inspecting registered commands and JSON Schemas programmatically:

```ts
import { buildHelpDocument, cli, command } from "clerc";

const app = cli({
  name: "acme",
  version: "2.0.0",
  commands: [
    command("build", {
      description: "Build project",
      run() {},
    }),
  ],
});

const model = app.buildModel();
const helpAst = await buildHelpDocument(model);
// helpAst.commandGroups[0].items -> [{ name: "build", ... }]
```

<CliPlayground :scenario="inspectModel" lang="en" />
