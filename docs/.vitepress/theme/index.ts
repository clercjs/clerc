import TwoslashFloatingVue from "@shikijs/vitepress-twoslash/client";
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import CopyOrDownloadAsMarkdownButtons from "vitepress-plugin-llms/vitepress-components/CopyOrDownloadAsMarkdownButtons.vue";

import { HomeLanding } from "../components/HomeLanding.ts";
import { TeamPage } from "../components/TeamPage.ts";
import { TerminalWindow } from "../components/TerminalWindow.ts";
import { CliPlayground } from "../playground/CliPlayground.ts";

import "@shikijs/vitepress-twoslash/style.css";
import "virtual:uno.css";
import "virtual:group-icons.css";
import "./style.css";

let twoslashDragResetBound = false;

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
    app.use(TwoslashFloatingVue, {
      themes: {
        twoslash: {
          flip: true,
        },
      },
    });
    if (typeof window !== "undefined" && !twoslashDragResetBound) {
      twoslashDragResetBound = true;
      // @shikijs/vitepress-twoslash tracks mousedown/mouseup to suppress poppers
      // while dragging; reset its flag if the pointer leaves or loses focus.
      function resetTwoslashDrag() {
        window.dispatchEvent(new MouseEvent("mouseup"));
      }
      window.addEventListener("blur", resetTwoslashDrag, { passive: true });
      window.addEventListener("dragend", resetTwoslashDrag, { passive: true });
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          resetTwoslashDrag();
        }
      });
    }
  },
} satisfies Theme;
