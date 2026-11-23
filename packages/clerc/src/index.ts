import type { CreateCliOptions } from "@clerc/core";
import { createCli } from "@clerc/core";

import { errorPlugin } from "./plugins/error";
import { helpPlugin } from "./plugins/help";
import { strictFlagsPlugin } from "./plugins/strict-flags";
import { versionPlugin } from "./plugins/version";

export * from "@clerc/core";
export * from "./plugins";

export const Cli = (options?: CreateCliOptions) =>
  createCli(options)
    .use(versionPlugin())
    .use(helpPlugin())
    .use(strictFlagsPlugin())
    .use(errorPlugin());
