# @clerc/logger

Minimal CLI logger with 7-column aligned word labels, `node:util` `inspect`, Clack-powered `box` / `spinner` / `task`, and structured JSON output.

## Usage

```ts
import { createLogger } from "@clerc/logger";

const log = createLogger({ level: "debug" });

log.child("db").step("Deploying to staging", "port=3000", "cache=true");

const s = log.spinner();
s.start("Checking remote state...");
s.stop("Remote state verified");

await log.task("Building bundle...", async (task) => {
  task.message("Generating declarations...");

  return "Bundle ready";
});

log.box.info(
  "Dry run summary",
  "No remote resources were mutated.",
  `Run ${log.theme.accent("acme deploy --confirm")} to publish.`,
);
```
