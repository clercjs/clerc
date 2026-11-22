import { defineConfig } from "vitepress";

import { enConfig } from "./en.ts";
import { sharedConfig } from "./shared.ts";
import { zhConfig } from "./zh.ts";

export default defineConfig({
  ...sharedConfig,
  locales: {
    root: {
      label: "English",
      link: "/",
      ...enConfig,
    },
    zh: {
      label: "简体中文",
      link: "/zh/",
      ...zhConfig,
    },
  },
});
