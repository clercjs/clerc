---
title: Error Handling
---

<script setup>
import { clercError, typoSuggestions } from "./errors.playground.ts";
</script>

# Error Handling

Parse and usage errors exit with code `2`, while runtime and validation errors exit with code `1`. For unknown commands and flags, Clerc suggests the closest match.

## Typo Suggestions

<CliPlayground :scenario="typoSuggestions" lang="en" />

## Throwing `ClercError`

Throw `ClercError` in your own commands to render matching diagnostics with `detail`, `hints`, and `usage`:

```ts
import { ClercError, clerc } from "clerc";

const cli = clerc({ name: "acme", version: "1.0.0" }).command("publish", {
  run() {
    throw new ClercError("not logged in to registry", {
      code: "ERR_AUTH",
      detail: "No token found in ~/.acmerc or ACME_TOKEN",
      usage: "acme login --registry https://registry.example.com",
    }).addHint("run 'acme login' first or set ACME_TOKEN");
  },
});
```

<CliPlayground :scenario="clercError" lang="en" />

## Custom `.onError()` Handlers

Register `.onError((err, ctx) => ...)` handlers to intercept errors in reverse registration (LIFO) order. Returning `true` marks the error as handled and suppresses default diagnostic printing:

```ts
const cli = clerc({ name: "acme", version: "1.0.0" }).onError((err, ctx) => {
  ctx.log.error("Unhandled failure", err.message);

  return true;
});
```
