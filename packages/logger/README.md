# @clerc/logger

Minimal CLI logger with aligned word labels, optional rail style, callouts, and structured JSON output.

## Usage

```ts
import { createLogger } from "@clerc/logger";

const log = createLogger({ level: "debug" });
log.step("Deploying to staging", "port=3000, cache=true");
log.success("Deployed!");
```
