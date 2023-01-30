import { Clerc } from "@clerc/core";

export const Cli = (locale?: string) => Clerc.create()
  .locale(locale || "en")
  .name("test")
  .description("test")
  .version("0.0.0");
