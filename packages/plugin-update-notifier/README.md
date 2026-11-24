# @clerc/plugin-update-notifier

Zero-dependency, non-blocking npm update notifier plugin for [Clerc](https://clerc.so1ve.dev).

## Usage

```ts
import { updateNotifierPlugin } from "@clerc/plugin-update-notifier";
import { clerc } from "clerc";

const cli = clerc({
  name: "acme-cli",
  version: "2.0.0",
}).use(updateNotifierPlugin());
```
