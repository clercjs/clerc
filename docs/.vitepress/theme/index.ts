import TwoslashFloatingVue from "@shikijs/vitepress-twoslash/client";
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";

import { CliPlayground } from "../components/CliPlayground.ts";
import { loadCopyOrDownloadAsMarkdownButtons } from "../components/CopyOrDownloadAsMarkdownButtons.ts";
import { TerminalWindow } from "../components/TerminalWindow.ts";

import "./style.css";
import "virtual:uno.css";
import "virtual:group-icons.css";
import "@shikijs/vitepress-twoslash/style.css";

export default {
  extends: DefaultTheme,
  async enhanceApp({ app }) {
    app.component("CliPlayground", CliPlayground);
    app.component("TerminalWindow", TerminalWindow);
    app.component(
      "CopyOrDownloadAsMarkdownButtons",
      await loadCopyOrDownloadAsMarkdownButtons,
    );
    app.use(TwoslashFloatingVue);
  },
} satisfies Theme;
