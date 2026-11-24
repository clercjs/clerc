import type { PropType, VNodeChild } from "vue";
import { defineComponent, h } from "vue";

const TOKEN_RE =
  /\{(brand|cyan|tip|green|yellow|red|bold|heading|muted|faint):((?:[^{}]|\{[^{}]*\})*)\}/g;

function renderTaggedLine(line: string, lineIdx: number): VNodeChild[] {
  const nodes: VNodeChild[] = [];
  let lastIndex = 0;
  for (const match of line.matchAll(TOKEN_RE)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      nodes.push(line.slice(lastIndex, start));
    }
    nodes.push(
      h(
        "span",
        { key: `${lineIdx}-${start}`, class: `t-${match[1]}` },
        match[2],
      ),
    );
    lastIndex = start + match[0].length;
  }
  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }

  return nodes;
}

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
      const bodyChildren: VNodeChild[] = props.lines
        ? props.lines.flatMap((line, idx) =>
            idx < props.lines!.length - 1
              ? [...renderTaggedLine(line, idx), "\n"]
              : renderTaggedLine(line, idx),
          )
        : [slots.default?.()];

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
        h("pre", { class: "clerc-term-body" }, [h("code", bodyChildren)]),
      ]);
    };
  },
});
