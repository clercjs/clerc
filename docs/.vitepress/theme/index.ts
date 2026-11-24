import TwoslashFloatingVue from "@shikijs/vitepress-twoslash/client";
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import CopyOrDownloadAsMarkdownButtons from "vitepress-plugin-llms/vitepress-components/CopyOrDownloadAsMarkdownButtons.vue";

import { CliPlayground } from "../components/CliPlayground.ts";
import { HomeLanding } from "../components/HomeLanding.ts";
import { TeamPage } from "../components/TeamPage.ts";
import { TerminalWindow } from "../components/TerminalWindow.ts";

import "./style.css";
import "virtual:uno.css";
import "virtual:group-icons.css";
import "@shikijs/vitepress-twoslash/style.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("CliPlayground", CliPlayground);
    app.component("HomeLanding", HomeLanding);
    app.component("TeamPage", TeamPage);
    app.component("TerminalWindow", TerminalWindow);
    app.component(
      "CopyOrDownloadAsMarkdownButtons",
      CopyOrDownloadAsMarkdownButtons,
    );
    app.use(TwoslashFloatingVue);
  },
} satisfies Theme;
