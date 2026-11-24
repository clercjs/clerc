import type { PropType, VNodeChild } from "vue";
import { computed, defineComponent, h, onBeforeUnmount, ref, watch } from "vue";

import type { ScenarioId } from "./playground-scenarios.ts";
import {
  SCENARIOS,
  computeModelGhostSuffix,
  runScenarioCli,
} from "./playground-scenarios.ts";
import type { TerminalBlock } from "./terminal-render.ts";
import { renderTerminalBlocks } from "./terminal-render.ts";

const TS_TOKEN_RE =
  /(\/\/[^\n]*)|(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(import|from|const|if|else|try|finally|async|await|true|false|return|new|throw)\b|\b(Types|Boolean|String|Number|ClercError|TypeError|Error|TypeFunction)\b|\b(\d[\d_]*)\b/g;

function highlightTs(code: string): VNodeChild[] {
  const nodes: VNodeChild[] = [];
  let lastIndex = 0;
  let idx = 0;
  for (const m of code.matchAll(TS_TOKEN_RE)) {
    const start = m.index ?? 0;
    if (start > lastIndex) {
      nodes.push(code.slice(lastIndex, start));
    }
    const cls = m[1]
      ? "tok-cmt"
      : m[2]
        ? "tok-str"
        : m[3]
          ? "tok-kw"
          : m[4]
            ? "tok-typ"
            : "tok-num";
    nodes.push(h("span", { key: `t-${idx++}`, class: cls }, m[0]));
    lastIndex = start + m[0].length;
  }
  if (lastIndex < code.length) {
    nodes.push(code.slice(lastIndex));
  }

  return nodes;
}

export const CliPlayground = defineComponent({
  name: "CliPlayground",
  props: {
    lang: {
      type: String as PropType<"en" | "zh">,
      default: "en",
    },
    preset: {
      type: String as PropType<ScenarioId>,
      default: "default",
    },
    variant: {
      type: String as PropType<"compact" | "split">,
      default: "compact",
    },
  },
  setup(props) {
    const scenario = computed(
      () => SCENARIOS[props.preset] ?? SCENARIOS.default,
    );
    const model = computed(() => scenario.value.createCli().buildModel());
    const binName = computed(() => model.value.meta.name);
    const highlightedCode = computed(() => highlightTs(scenario.value.source));

    const initialCmd = scenario.value.presets[0]?.cmd ?? "--help";
    const commandInput = ref<string>(initialCmd);
    const committedInput = ref<string>(initialCmd);
    const activeTab = ref<"terminal" | "code">("terminal");
    const isFocused = ref(false);
    const inputScrollLeft = ref(0);
    const inputEl = ref<HTMLInputElement | null>(null);
    const history = ref<string[]>(scenario.value.presets.map((p) => p.cmd));
    const historyCursor = ref(-1);

    const exitCode = ref(0);
    const blocks = ref<readonly TerminalBlock[]>([]);

    let runSeq = 0;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    async function executeNow(raw: string): Promise<void> {
      const seq = ++runSeq;
      const result = await runScenarioCli(scenario.value, raw);
      if (seq === runSeq) {
        exitCode.value = result.exitCode;
        blocks.value = result.blocks;
      }
    }

    if (!import.meta.env.SSR) {
      watch(
        committedInput,
        (raw) => {
          void executeNow(raw);
        },
        { immediate: true },
      );
    }

    onBeforeUnmount(() => {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }
    });

    function setImmediateCommand(next: string, pushHistory = false): void {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
      }
      commandInput.value = next;
      committedInput.value = next;
      if (pushHistory && next.trim() && history.value.at(-1) !== next.trim()) {
        history.value.push(next.trim());
      }
      historyCursor.value = -1;
    }

    function scheduleEvaluation(next: string): void {
      commandInput.value = next;
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }
      if (next.endsWith(" ") || next.length === 0) {
        committedInput.value = next;

        return;
      }
      debounceTimer = setTimeout(() => {
        committedInput.value = next;
      }, 100);
    }

    const ghostSuffix = computed(() =>
      isFocused.value && inputScrollLeft.value === 0
        ? computeModelGhostSuffix(model.value, commandInput.value)
        : "",
    );

    function acceptGhost(): void {
      const suffix = computeModelGhostSuffix(model.value, commandInput.value);
      if (!suffix) {
        return;
      }
      setImmediateCommand(commandInput.value + suffix);
      inputEl.value?.focus();
    }

    function handleKeydown(e: KeyboardEvent): void {
      const suffix = computeModelGhostSuffix(model.value, commandInput.value);
      if (e.key === "Tab" && suffix.length > 0 && inputScrollLeft.value === 0) {
        e.preventDefault();
        setImmediateCommand(commandInput.value + suffix);

        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        setImmediateCommand(commandInput.value, true);

        return;
      }
      if (e.key === "Escape" && commandInput.value.length > 0) {
        e.preventDefault();
        setImmediateCommand("");

        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const list = history.value;
        if (list.length === 0) {
          return;
        }
        const nextIdx =
          historyCursor.value === -1
            ? list.length - 1
            : Math.max(0, historyCursor.value - 1);
        historyCursor.value = nextIdx;
        setImmediateCommand(list[nextIdx]);

        return;
      }
      if (e.key === "ArrowDown" && historyCursor.value !== -1) {
        e.preventDefault();
        const list = history.value;
        if (historyCursor.value >= list.length - 1) {
          historyCursor.value = -1;
          setImmediateCommand("");
        } else {
          historyCursor.value += 1;
          setImmediateCommand(list[historyCursor.value]);
        }
      }
    }

    return () => {
      const isZh = props.lang === "zh";
      const isSplit = props.variant === "split";

      const codePane = h("div", { class: "pg-pane pg-pane-code" }, [
        h("div", { class: "pg-bar" }, [
          h("span", { class: "pg-filename" }, "cli.ts"),
          h("span", { class: "pg-meta" }, "Node.js 24+ · ESM"),
        ]),
        h("pre", { class: "pg-code" }, [h("code", highlightedCode.value)]),
      ]);

      const terminalBody = h("div", { class: "pg-terminal-body" }, [
        h("label", { class: "pg-prompt" }, [
          h("span", { "class": "pg-dollar", "aria-hidden": "true" }, "$"),
          h("span", { class: "pg-bin" }, binName.value),
          h("span", { class: "pg-input-wrap" }, [
            h("span", { "class": "pg-mirror", "aria-hidden": "true" }, [
              h("span", { class: "pg-mirror-typed" }, commandInput.value),
              h("span", { class: "pg-mirror-ghost" }, ghostSuffix.value),
            ]),
            h("input", {
              "ref": inputEl,
              "value": commandInput.value,
              "type": "text",
              "aria-label": isZh ? "命令行参数" : "Command arguments",
              "spellcheck": false,
              "autocomplete": "off",
              "autocapitalize": "off",
              "class": "pg-input",
              "placeholder": isZh
                ? "输入任意命令或参数，按 Tab 补全"
                : "Type arguments or flags, Tab to complete",
              "onFocus": () => {
                isFocused.value = true;
              },
              "onBlur": () => {
                isFocused.value = false;
              },
              "onScroll": (e: Event) => {
                inputScrollLeft.value = (
                  e.target as HTMLInputElement
                ).scrollLeft;
              },
              "onInput": (e: Event) => {
                const target = e.target as HTMLInputElement;
                inputScrollLeft.value = target.scrollLeft;
                scheduleEvaluation(target.value);
              },
              "onKeydown": handleKeydown,
            }),
          ]),
          ghostSuffix.value
            ? h(
                "button",
                {
                  type: "button",
                  class: "pg-kbd",
                  title: isZh ? "按 Tab 自动补全" : "Press Tab to complete",
                  onMousedown: (e: MouseEvent) => {
                    e.preventDefault();
                    acceptGhost();
                  },
                },
                "Tab",
              )
            : null,
          commandInput.value.length > 0
            ? h(
                "button",
                {
                  "type": "button",
                  "class": "pg-clear",
                  "aria-label": isZh ? "清空输入" : "Clear command",
                  "onClick": (e: MouseEvent) => {
                    e.preventDefault();
                    setImmediateCommand("");
                    inputEl.value?.focus();
                  },
                },
                "×",
              )
            : null,
        ]),
        h(
          "div",
          { "class": "pg-output", "role": "region", "aria-live": "polite" },
          [renderTerminalBlocks(blocks.value)],
        ),
        h(
          "div",
          { class: "pg-footer" },
          scenario.value.presets.map((preset) =>
            h(
              "button",
              {
                "key": preset.cmd,
                "type": "button",
                "aria-pressed": commandInput.value.trim() === preset.cmd,
                "class": [
                  "pg-preset",
                  { active: commandInput.value.trim() === preset.cmd },
                ],
                "onClick": () => {
                  setImmediateCommand(preset.cmd, true);
                  activeTab.value = "terminal";
                },
              },
              preset.label ?? preset.cmd,
            ),
          ),
        ),
      ]);

      const tabControls = h(
        "div",
        {
          class: ["pg-tabs", { "pg-tabs-mobile-only": isSplit }],
          role: "tablist",
        },
        [
          h(
            "button",
            {
              "type": "button",
              "role": "tab",
              "aria-selected": activeTab.value === "terminal",
              "class": ["pg-tab", { active: activeTab.value === "terminal" }],
              "onClick": () => {
                activeTab.value = "terminal";
              },
            },
            isZh ? "交互终端" : "Terminal",
          ),
          h(
            "button",
            {
              "type": "button",
              "role": "tab",
              "aria-selected": activeTab.value === "code",
              "class": ["pg-tab", { active: activeTab.value === "code" }],
              "onClick": () => {
                activeTab.value = "code";
              },
            },
            "cli.ts",
          ),
        ],
      );

      const termPane = h("div", { class: "pg-pane pg-pane-term" }, [
        h("div", { class: "pg-bar" }, [
          isSplit
            ? h(
                "span",
                { class: "pg-filename pg-desktop-label" },
                `${binName.value} — zsh`,
              )
            : null,
          tabControls,
          h(
            "span",
            {
              class: ["pg-exit", exitCode.value === 0 ? "ok" : "err"],
            },
            `exit ${exitCode.value}`,
          ),
        ]),
        activeTab.value === "code"
          ? h("pre", { class: "pg-code pg-code-tabbed" }, [
              h("code", highlightedCode.value),
            ])
          : terminalBody,
      ]);

      return h(
        "section",
        {
          "class": ["pg-workbench", isSplit ? "is-split" : "is-compact"],
          "aria-label": isZh ? "交互式终端演示" : "Interactive CLI playground",
        },
        isSplit ? [codePane, termPane] : [termPane],
      );
    };
  },
});
