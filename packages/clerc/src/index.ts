import type { CreateOptions } from "@clerc/core";
import { Clerc } from "@clerc/core";

import { errorPlugin } from "./plugins/error";
import { helpPlugin } from "./plugins/help";
import { notFoundPlugin } from "./plugins/not-found";
import { versionPlugin } from "./plugins/version";

export * from "@clerc/core";
export * from "./plugins";

export const Cli = (options?: CreateOptions) =>
  Clerc.create(options)
    .use(versionPlugin())
    .use(helpPlugin())
    .use(notFoundPlugin())
    .use(errorPlugin());
