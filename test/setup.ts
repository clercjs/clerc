import { expect } from "vitest";
import { matchers } from "vitest-console";

// Force color output for consistent snapshots
// @uttr/tint disables colors in non-TTY environments
process.env.FORCE_COLOR = "1";

expect.extend(matchers);
