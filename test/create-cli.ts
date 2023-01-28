import { Clerc } from "@clerc/core";

export const Cli = () => Clerc.create()
  .locale("en")
  .name("test")
  .description("test")
  .version("0.0.0");
