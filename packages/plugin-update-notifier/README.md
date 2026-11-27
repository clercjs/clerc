# @clerc/plugin-update-notifier

Zero-dependency, non-blocking npm update notifier middleware for [Clerc](https://clerc.so1ve.dev).

## Usage

```ts
import { updateNotifier } from "@clerc/plugin-update-notifier";
import { cli } from "clerc";

const app = cli({
  name: "acme-cli",
  version: "2.0.0",
  use: [updateNotifier()],
  commands: [
    // ...
  ],
});
```
