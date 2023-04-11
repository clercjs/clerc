import { defineConfig } from "mini-cz";
import configDefault from "@mini-cz/config-default";

export default defineConfig({
  ...configDefault,
  scopes: [
    "clerc",
    "core",
    "utils",
    "toolkit",
    "plugin-help",
    "plugin-completions",
    "plugin-friendly-error",
    "plugin-not-found",
    "plugin-strict-flags",
    "plugin-version",
  ],
});
