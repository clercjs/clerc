# @clerc/theme

Zero-dependency semantic CLI theme and terminal capability detection built on `node:util` `styleText`.

## Usage

```ts
import { createTheme, detectColor } from "@clerc/theme";

const theme = createTheme(detectColor());
console.log(theme.brand("acme"), theme.muted("v2.0.0"));
```
