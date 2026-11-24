import type { PropType } from "vue";
import { defineComponent, h } from "vue";

import { parseTaggedLines, renderTerminalBlocks } from "./terminal-render.ts";

export const TerminalWindow = defineComponent({
  name: "TerminalWindow",
  props: {
    command: { type: String, default: undefined },
    title: { type: String, default: undefined },
    lines: {
      type: Array as PropType<readonly string[]>,
      default: undefined,
    },
  },
  setup(props, { slots }) {
    return () => {
      const body = props.lines
        ? renderTerminalBlocks(parseTaggedLines(props.lines))
        : h("pre", { class: "clerc-term-raw" }, [
            h("code", [slots.default?.()]),
          ]);

      return h("div", { class: "clerc-term" }, [
        props.command || props.title
          ? h("div", { class: "clerc-term-bar" }, [
              props.command
                ? h("span", { class: "clerc-term-cmd" }, [
                    h("span", { class: "t-muted" }, "$ "),
                    props.command,
                  ])
                : h("span", { class: "clerc-term-title" }, props.title),
            ])
          : null,
        h("div", { class: "clerc-term-body" }, [body]),
      ]);
    };
  },
});
