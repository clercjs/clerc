---
title: "verbosityPlugin (Built-in)"
---

# `verbosityPlugin`

Built directly into `clerc` (no extra package to install). Adds global `-q, --quiet` and `-v, --verbose` flags and wires them to `ctx.log.level` in a `{ enforce: "pre" }` middleware so every downstream plugin, deprecation warning, and command handler respects the user's verbosity level.

## Usage

```ts
import { clerc, verbosityPlugin } from "clerc";

const cli = clerc({
  name: "acme",
  version: "2.0.0",
}).use(verbosityPlugin());

cli.command("sync", {
  run(ctx) {
    ctx.flags.quiet; // boolean
    ctx.flags.verbose; // number (-v -> 1, -vv -> 2)

    ctx.log.debug("Shown when -v / --verbose is passed");
    ctx.log.info("Suppressed when -q / --quiet is passed");
  },
});
```

## Behavior

| Flag            | Effect on `ctx.log.level`                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| _(none)_        | Keeps configured default (`"info"`).                                                                                              |
| `-q, --quiet`   | Sets `ctx.log.level = "error"` (suppresses `step`, `info`, `done`, `debug`, and `warn` including deprecation and update banners). |
| `-v, --verbose` | Counter flag (`[Boolean]`); when `> 0`, sets `ctx.log.level = "debug"` (also enables stack traces in error diagnostics).          |
