---
title: Error Handling
---

<script setup>
import scenario from "./errors.playground.ts";
</script>

# Error Handling

Parse and usage errors exit with code `2`, while runtime and validation errors exit with code `1`. For unknown commands and flags, Clerc suggests the closest match.

<CliPlayground :scenario="scenario" lang="en" />

## Typo Suggestions

<TerminalWindow command="acme deploy prod --outpt dist" :lines='["{red:error} unexpected option: &#39;--outpt&#39;","","  {tip:tip} a similar option exists: &#39;--output&#39;","","      {muted:For more information, try &#39;acme deploy --help&#39;.}"]' />

## Throwing `ClercError`

Throw `ClercError` in your own commands to render matching diagnostics with `detail`, `hints`, and `usage`:

```ts
import { ClercError, clerc } from "clerc";

const cli = clerc({ name: "acme", version: "1.0.0" }).command("publish", {
  run() {
    throw new ClercError("not logged in to registry", {
      code: "ERR_VALIDATION",
      detail: "No token found in ~/.acmerc or ACME_TOKEN",
      usage: "acme login --registry https://registry.example.com",
    }).addHint("run 'acme login' first or set ACME_TOKEN");
  },
});
```

## Custom `.onError()` Handlers

Register `.onError((err, ctx) => ...)` handlers to intercept errors in reverse registration (LIFO) order. Returning `true` marks the error as handled and suppresses default diagnostic printing:

```ts
const cli = clerc({ name: "acme", version: "1.0.0" }).onError((err, ctx) => {
  ctx.log.error("Unhandled failure", err.message);

  return true;
});
```

## JSON Error Output

When `ctx.log.format === "json"` (or `logger: { format: "json" }`), unhandled errors serialize as single-line JSON to `stderr`:

```json
{
  "error": {
    "code": "ERR_UNKNOWN_COMMAND",
    "message": "unknown command 'buid'",
    "hints": ["a similar command exists: 'build'"],
    "exitCode": 2
  }
}
```
