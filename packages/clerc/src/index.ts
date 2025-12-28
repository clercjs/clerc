import type { CreateOptions } from "@clerc/core";
import { Clerc } from "@clerc/core";
import { helpPlugin } from "@clerc/plugin-help";
import { versionPlugin } from "@clerc/plugin-version";

export * from "./re-exports";

export const Cli = (options?: CreateOptions): Clerc =>
  Clerc.create(options).use(versionPlugin()).use(helpPlugin());
