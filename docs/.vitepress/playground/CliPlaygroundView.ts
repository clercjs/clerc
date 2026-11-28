import { createLogger } from "@clerc/logger";
import type { PropType, VNodeChild } from "vue";
import { computed, defineComponent, h, onBeforeUnmount, ref, watch } from "vue";

import type { TerminalBlock } from "../components/terminal-render.ts";
import {
  parseAnsiLines,
  renderTerminalBlocks,
} from "../components/terminal-render.ts";
import { PromptWidget } from "./PromptWidget.ts";
import type { ActivePrompt, PlaygroundScenario } from "./runtime.ts";
import { SPINNER_FRAMES, runScenarioCli, runScenarioLive } from "./runtime.ts";
import { useCompletion } from "./useCompletion.ts";

export const CliPlaygroundView = defineComponent({
  name: "CliPlaygroundView",
  props: {
    lang: {
      type: String as PropType<"en" | "zh">,
      default: "en",
    },
    scenario: {
      type: Object as PropType<PlaygroundScenario>,
      required: true,
    },
    variant: {
      type: String as PropType<"inline" | "compact" | "split">,
      default: "inline",
    },
  },
  setup(props) {
    const scenario = computed(() => props.scenario);
    const model = computed(() => scenario.value.createCli().buildModel());
    const binName = computed(() => model.value.meta.name);
    const hasSource = computed(
      () =>
        typeof scenario.value.source === "string" &&
        scenario.value.source.length > 0,
    );
    const hasCodeTab = computed(
      () => props.variant !== "inline" && hasSource.value,
    );

    const initialCmd = scenario.value.presets[0]?.cmd ?? "--help";
    const commandInput = ref<string>(initialCmd);
    const committedInput = ref<string>(initialCmd);
    const activeTab = ref<"terminal" | "code">("terminal");
    const copiedSource = ref(false);
    const isFocused = ref(false);
    const inputScrollLeft = ref(0);
    const inputEl = ref<HTMLInputElement | null>(null);
    const history = ref<string[]>(scenario.value.presets.map((p) => p.cmd));
    const historyCursor = ref(-1);

    const exitCode = ref<number | null>(null);
    const isRunning = ref(true);
    const hasInteracted = ref(false);
    const blocks = ref<readonly TerminalBlock[]>([]);
    const spinnerText = ref<string | null>(null);
    const spinnerFrameIdx = ref(0);
    const activePrompt = ref<ActivePrompt | null>(null);

    const manualLines = ref<string[]>([]);
    const manualSpinning = ref(false);
    const manualMsgIdx = ref(0);

    let runSeq = 0;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let spinnerTimer: ReturnType<typeof setInterval> | undefined;
    let copyTimer: ReturnType<typeof setTimeout> | undefined;
    let activeController: AbortController | null = null;

    const prefersReducedMotion = (): boolean =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    async function copySourceCode(): Promise<void> {
      const code = scenario.value.source;
      if (!code || typeof navigator === "undefined" || !navigator.clipboard) {
        return;
      }
      try {
        await navigator.clipboard.writeText(code);
        copiedSource.value = true;
        if (copyTimer !== undefined) {
          clearTimeout(copyTimer);
        }
        copyTimer = setTimeout(() => {
          copiedSource.value = false;
        }, 1800);
      } catch {
        // Ignore clipboard errors in restricted contexts
      }
    }

    function syncSpinnerTicker(running: boolean): void {
      if (spinnerTimer !== undefined) {
        clearInterval(spinnerTimer);
        spinnerTimer = undefined;
      }
      if (!running || prefersReducedMotion()) {
        spinnerFrameIdx.value = 1;

        return;
      }
      spinnerTimer = setInterval(() => {
        spinnerFrameIdx.value =
          (spinnerFrameIdx.value + 1) % SPINNER_FRAMES.length;
      }, 85);
    }

    watch(
      () => spinnerText.value !== null,
      (spinning) => {
        syncSpinnerTicker(spinning);
      },
    );

    function runManualAction(
      action: "start" | "message" | "stop" | "cancel" | "error",
    ): void {
      const spec = scenario.value.manualSpinner;
      if (!spec) {
        return;
      }
      activeTab.value = "terminal";
      const logger = createLogger({
        color: true,
        unicode: true,
        terminal: {
          stdout(text) {
            manualLines.value = [...manualLines.value, ...text.split("\n")];
          },
          stderr(text) {
            manualLines.value = [...manualLines.value, ...text.split("\n")];
          },
        },
      });

      if (action === "start") {
        manualLines.value = [];
        manualMsgIdx.value = 0;
        manualSpinning.value = true;
        spinnerText.value = spec.startText;
        blocks.value = [];
        exitCode.value = null;
        isRunning.value = true;

        return;
      }
      if (!manualSpinning.value) {
        return;
      }
      if (action === "message") {
        const msg =
          spec.messages[manualMsgIdx.value % spec.messages.length] ??
          spec.startText;
        manualMsgIdx.value += 1;
        spinnerText.value = msg;

        return;
      }

      manualSpinning.value = false;
      spinnerText.value = null;
      isRunning.value = false;
      if (action === "stop") {
        logger.success(spec.stopText);
        exitCode.value = 0;
      } else if (action === "cancel") {
        logger.warn(spec.cancelText);
        exitCode.value = 0;
      } else {
        logger.error(spec.errorText);
        exitCode.value = 1;
      }
      blocks.value = parseAnsiLines(manualLines.value);
    }

    async function executeNow(raw: string): Promise<void> {
      if (scenario.value.manualSpinner) {
        runManualAction("start");

        return;
      }
      if (activeController) {
        activeController.abort();
        activeController = null;
      }
      const seq = ++runSeq;
      spinnerText.value = null;
      activePrompt.value = null;
      isRunning.value = true;
      exitCode.value = null;

      if (scenario.value.live) {
        const controller = new AbortController();
        activeController = controller;
        blocks.value = [];

        const result = await runScenarioLive(scenario.value, raw, {
          signal: controller.signal,
          onUpdate(snap) {
            if (seq !== runSeq) {
              return;
            }
            blocks.value = snap.blocks;
            spinnerText.value = snap.spinnerText;
            activePrompt.value = snap.prompt;
          },
        });
        if (seq === runSeq && !result.aborted) {
          isRunning.value = false;
          spinnerText.value = null;
          activePrompt.value = null;
          exitCode.value = result.exitCode;
          blocks.value = result.blocks;
        }

        return;
      }

      const result = await runScenarioCli(scenario.value, raw);
      if (seq === runSeq) {
        isRunning.value = false;
        exitCode.value = result.exitCode;
        blocks.value = result.blocks;
      }
    }

    function setImmediateCommand(next: string, pushHistory = false): void {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
      }
      activeTab.value = "terminal";
      const unchanged = committedInput.value === next;
      commandInput.value = next;
      committedInput.value = next;
      if (unchanged && (scenario.value.live || scenario.value.manualSpinner)) {
        void executeNow(next);
      }
      if (pushHistory && next.trim() && history.value.at(-1) !== next.trim()) {
        history.value.push(next.trim());
      }
      historyCursor.value = -1;
    }

    function scheduleEvaluation(next: string): void {
      activeTab.value = "terminal";
      commandInput.value = next;
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }
      if (next.length === 0) {
        committedInput.value = next;

        return;
      }
      debounceTimer = setTimeout(
        () => {
          committedInput.value = next;
        },
        scenario.value.live ? 300 : 220,
      );
    }

    const {
      menuOpen,
      activeCompIdx,
      compMenuEl,
      completionQuery,
      ghostSuffix,
      refreshCompletions,
      applyCompletion,
      triggerTabCompletion,
      handleKeydown,
    } = useCompletion({
      model,
      env: computed(() => scenario.value.env),
      commandInput,
      isFocused,
      inputScrollLeft,
      inputEl,
      history,
      historyCursor,
      setImmediateCommand,
    });

    watch(scenario, (nextScenario) => {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
      }
      if (activeController) {
        activeController.abort();
        activeController = null;
      }
      const nextInitial = nextScenario.presets[0]?.cmd ?? "--help";
      commandInput.value = nextInitial;
      committedInput.value = nextInitial;
      history.value = nextScenario.presets.map((p) => p.cmd);
      historyCursor.value = -1;
      menuOpen.value = false;
      activeCompIdx.value = 0;
      activeTab.value = "terminal";
      copiedSource.value = false;
      spinnerText.value = null;
      activePrompt.value = null;
      blocks.value = [];
      exitCode.value = null;
      isRunning.value = true;
    });

    if (!import.meta.env.SSR) {
      watch(
        [scenario, committedInput],
        ([, raw]) => {
          void executeNow(raw);
        },
        { immediate: true },
      );
    }

    onBeforeUnmount(() => {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
      }
      if (spinnerTimer !== undefined) {
        clearInterval(spinnerTimer);
      }
      if (copyTimer !== undefined) {
        clearTimeout(copyTimer);
      }
      if (activeController) {
        activeController.abort();
      }
    });

    function renderCodeBlock(extraClass?: string) {
      const codeHtml = scenario.value.sourceHtml;

      return h(
        "pre",
        { class: ["pg-code", "shiki", extraClass] },
        codeHtml
          ? [h("code", { innerHTML: codeHtml })]
          : [h("code", scenario.value.source ?? "")],
      );
    }

    return () => {
      const isZh = props.lang === "zh";
      const isSplit = props.variant === "split";
      const isInline = props.variant === "inline";
      const isManual = Boolean(scenario.value.manualSpinner);
      const showInlineCode =
        isInline && hasSource.value && activeTab.value === "code";

      const exitBadge =
        exitCode.value === null
          ? h("span", { class: "pg-exit running" }, [
              h("span", { "class": "pg-live-dot", "aria-hidden": "true" }),
              isZh ? "运行中" : "running",
            ])
          : h(
              "span",
              { class: ["pg-exit", exitCode.value === 0 ? "ok" : "err"] },
              `exit ${exitCode.value}`,
            );

      const copyButton = h(
        "button",
        {
          "type": "button",
          "class": ["pg-copy-btn", { copied: copiedSource.value }],
          "aria-label": isZh ? "复制示例代码" : "Copy demo code",
          "onClick": () => {
            void copySourceCode();
          },
        },
        copiedSource.value
          ? isZh
            ? "已复制"
            : "Copied"
          : isZh
            ? "复制"
            : "Copy",
      );

      const inlineCodeToggle =
        isInline && hasSource.value
          ? h(
              "button",
              {
                "type": "button",
                "class": ["pg-code-toggle", { active: showInlineCode }],
                "aria-pressed": showInlineCode,
                "title": isZh ? "查看当前演示的运行代码" : "View demo code",
                "onClick": (e: MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  activeTab.value = showInlineCode ? "terminal" : "code";
                },
              },
              isZh ? "代码" : "Code",
            )
          : null;

      const replayButton =
        scenario.value.live && !isManual
          ? h(
              "button",
              {
                "type": "button",
                "class": "pg-replay",
                "title": isZh ? "重新运行" : "Replay",
                "aria-label": isZh ? "重新运行" : "Replay",
                "onClick": (e: MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  hasInteracted.value = true;
                  activeTab.value = "terminal";
                  void executeNow(commandInput.value);
                },
              },
              isZh ? "↻ 重播" : "↻ Replay",
            )
          : null;

      const codePane = h("div", { class: "pg-pane pg-pane-code" }, [
        h("div", { class: "pg-bar" }, [
          h("span", { class: "pg-filename" }, "cli.ts"),
          copyButton,
        ]),
        renderCodeBlock(),
      ]);

      const compItems = completionQuery.value.items;
      const showCompMenu = menuOpen.value && compItems.length > 0;

      const manualBar = isManual
        ? h("div", { class: "pg-presets pg-manual-bar" }, [
            h(
              "button",
              {
                type: "button",
                class: ["pg-preset", { active: manualSpinning.value }],
                onClick: () => runManualAction("start"),
              },
              "s.start()",
            ),
            ...(["message", "stop", "cancel", "error"] as const).map((act) =>
              h(
                "button",
                {
                  key: act,
                  type: "button",
                  class: "pg-preset",
                  disabled: !manualSpinning.value,
                  onClick: () => runManualAction(act),
                },
                `s.${act}()`,
              ),
            ),
            h("span", { class: "pg-manual-spacer" }),
            inlineCodeToggle,
            exitBadge,
          ])
        : null;

      const promptBar = isManual
        ? null
        : h("div", { class: "pg-prompt-box" }, [
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
                  "aria-expanded": showCompMenu,
                  "aria-autocomplete": "list",
                  "onBlur": () => {
                    isFocused.value = false;
                    menuOpen.value = false;
                  },
                  "onScroll": (e: Event) => {
                    inputScrollLeft.value = (
                      e.target as HTMLInputElement
                    ).scrollLeft;
                  },
                  "onInput": (e: Event) => {
                    const target = e.target as HTMLInputElement;
                    inputScrollLeft.value = target.scrollLeft;
                    activeCompIdx.value = 0;
                    scheduleEvaluation(target.value);
                    void refreshCompletions(target.value);
                  },
                  "onKeydown": handleKeydown,
                }),
              ]),
              isFocused.value && compItems.length > 0
                ? h(
                    "button",
                    {
                      type: "button",
                      class: "pg-kbd",
                      title: isZh
                        ? "按 Tab 展开或补全候选"
                        : "Press Tab to complete",
                      onMousedown: (e: MouseEvent) => {
                        e.preventDefault();
                        triggerTabCompletion(false);
                        inputEl.value?.focus();
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
                        menuOpen.value = false;
                        setImmediateCommand("");
                        inputEl.value?.focus();
                      },
                    },
                    "×",
                  )
                : null,
              isInline ? inlineCodeToggle : null,
              isInline ? replayButton : null,
              isInline ? exitBadge : null,
            ]),
            showCompMenu
              ? h(
                  "div",
                  {
                    "ref": compMenuEl,
                    "class": "pg-comp-menu",
                    "role": "listbox",
                    "aria-label": isZh ? "命令补全候选" : "Command completions",
                  },
                  compItems.map((item, idx) =>
                    h(
                      "button",
                      {
                        "key": item.value,
                        "type": "button",
                        "role": "option",
                        "aria-selected": idx === activeCompIdx.value,
                        "class": [
                          "pg-comp-item",
                          { active: idx === activeCompIdx.value },
                        ],
                        "onMousedown": (e: MouseEvent) => {
                          e.preventDefault();
                          applyCompletion(item);
                        },
                        "onMouseenter": () => {
                          activeCompIdx.value = idx;
                        },
                      },
                      [
                        h("span", { class: "pg-comp-val" }, item.value),
                        item.description
                          ? h(
                              "span",
                              { class: "pg-comp-desc" },
                              item.description,
                            )
                          : null,
                      ],
                    ),
                  ),
                )
              : null,
            isRunning.value
              ? h("span", {
                  "class": "pg-progress-beam",
                  "aria-hidden": "true",
                })
              : null,
          ]);

      const presetsBar =
        !isManual && scenario.value.presets.length > 1
          ? h(
              "div",
              { class: "pg-presets" },
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
                      menuOpen.value = false;
                      setImmediateCommand(preset.cmd, true);
                      activeTab.value = "terminal";
                    },
                  },
                  preset.label ?? preset.cmd,
                ),
              ),
            )
          : null;

      const spinnerRow =
        spinnerText.value === null
          ? null
          : h("div", { class: "t-line pg-spinner-line" }, [
              h(
                "span",
                { "class": "t-brand pg-spinner-glyph", "aria-hidden": "true" },
                `   ${SPINNER_FRAMES[spinnerFrameIdx.value]} `,
              ),
              h("span", { class: "t-bold" }, spinnerText.value),
            ]);

      const outputNodes: VNodeChild[] = [];
      if (blocks.value.length > 0) {
        outputNodes.push(renderTerminalBlocks(blocks.value));
      }
      if (spinnerRow) {
        outputNodes.push(spinnerRow);
      }
      if (activePrompt.value) {
        outputNodes.push(
          h(PromptWidget, {
            prompt: activePrompt.value,
            isZh,
            autoFocus: hasInteracted.value,
            onInteract: () => {
              hasInteracted.value = true;
            },
          }),
        );
      }
      if (outputNodes.length === 0 && isRunning.value) {
        outputNodes.push(
          h(
            "div",
            {
              "class": "pg-loading",
              "role": "status",
              "aria-live": "polite",
            },
            [
              h("span", { "class": "pg-matrix", "aria-hidden": "true" }, [
                h("span", { class: "pg-matrix-dot d1" }),
                h("span", { class: "pg-matrix-dot d2" }),
                h("span", { class: "pg-matrix-dot d3" }),
                h("span", { class: "pg-matrix-dot d4" }),
              ]),
              h(
                "span",
                { class: "pg-loading-label" },
                isZh ? "正在运行" : "Running",
              ),
            ],
          ),
        );
      }

      const inlineCodeView = h("div", { class: "pg-code-wrap" }, [
        h("div", { class: "pg-code-inline-bar" }, [
          h("span", { class: "pg-filename" }, "cli.ts"),
          copyButton,
        ]),
        renderCodeBlock("pg-code-inline"),
      ]);

      const terminalBody = h("div", { class: "pg-terminal-body" }, [
        manualBar,
        promptBar,
        showInlineCode ? null : presetsBar,
        showInlineCode
          ? inlineCodeView
          : h(
              "div",
              {
                "class": "pg-output",
                "role": "region",
                "aria-live": "polite",
              },
              outputNodes,
            ),
      ]);

      const tabControls = hasCodeTab.value
        ? h(
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
                  "class": [
                    "pg-tab",
                    { active: activeTab.value === "terminal" },
                  ],
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
          )
        : null;

      const showTabbedCode =
        !isInline && hasCodeTab.value && activeTab.value === "code";

      const termPane = h("div", { class: "pg-pane pg-pane-term" }, [
        isInline
          ? null
          : h("div", { class: "pg-bar" }, [
              isSplit
                ? h(
                    "span",
                    { class: "pg-filename pg-desktop-label" },
                    `${binName.value} — zsh`,
                  )
                : null,
              tabControls,
              h("div", { class: "pg-bar-right" }, [
                showTabbedCode ? copyButton : null,
                replayButton,
                exitBadge,
              ]),
            ]),
        showTabbedCode ? renderCodeBlock("pg-code-tabbed") : terminalBody,
      ]);

      return h(
        "section",
        {
          "class": [
            "pg-workbench",
            isSplit ? "is-split" : isInline ? "is-inline" : "is-compact",
            { "is-live": Boolean(scenario.value.live) },
          ],
          "aria-label": isZh ? "交互式终端演示" : "Interactive CLI playground",
        },
        isSplit ? [codePane, termPane] : [termPane],
      );
    };
  },
});
