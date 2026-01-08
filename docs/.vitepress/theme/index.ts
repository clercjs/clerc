import TwoslashFloatingVue from "@shikijs/vitepress-twoslash/client";
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";

import { loadCopyOrDownloadAsMarkdownButtons } from "../components/CopyOrDownloadAsMarkdownButtons";

import "./style.css";
import "virtual:uno.css";
import "virtual:group-icons.css";
import "@shikijs/vitepress-twoslash/style.css";

export default {
  extends: DefaultTheme,
  async enhanceApp({ app }) {
    app.component(
      "CopyOrDownloadAsMarkdownButtons",
      await loadCopyOrDownloadAsMarkdownButtons,
    );
    app.use(TwoslashFloatingVue);
  },
} satisfies Theme;
