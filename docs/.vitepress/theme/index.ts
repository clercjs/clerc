import TwoslashFloatingVue from "@shikijs/vitepress-twoslash/client";
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import CopyOrDownloadAsMarkdownButtons from "vitepress-plugin-llms/vitepress-components/CopyOrDownloadAsMarkdownButtons.vue";

import "./style.css";
import "virtual:uno.css";
import "virtual:group-icons.css";
import "@shikijs/vitepress-twoslash/style.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component(
      "CopyOrDownloadAsMarkdownButtons",
      CopyOrDownloadAsMarkdownButtons,
    );
    app.use(TwoslashFloatingVue);
  },
} satisfies Theme;
