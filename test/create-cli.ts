import { Clerc } from "@clerc/core";

export const Cli = () => Clerc.create()
  .name("test")
  .description("test")
  .version("0.0.0");
