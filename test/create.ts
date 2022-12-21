import { Clerc } from "@clerc/core";

export const create = () => Clerc.create()
  .name("test")
  .description("test")
  .version("0.0.0");
