import type { PropType, VNodeChild } from "vue";
import {
  computed,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  ref,
  watch,
} from "vue";

import type {
  ActivePrompt,
  CompletionEntry,
  CompletionQueryResult,
  PlaygroundScenario,
} from "./playground-runtime.ts";
import {
  SPINNER_FRAMES,
  computeGhostSuffix,
  createLogger,
  resolvePlaygroundCompletions,
  runScenarioCli,
  runScenarioLive,
} from "./playground-runtime.ts";
import type { TerminalBlock } from "./terminal-render.ts";
import { parseAnsiLines, renderTerminalBlocks } from "./terminal-render.ts";

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
    const hasCodeTab = computed(
      () =>
        props.variant !== "inline" &&
        typeof scenario.value.source === "string" &&
        scenario.value.source.length > 0,
    );
    const highlightedCode = computed(() =>
      scenario.value.source ? highlightTs(scenario.value.source) : [],
    );

    const initialCmd = scenario.value.presets[0]?.cmd ?? "--help";
    const commandInput = ref<string>(initialCmd);
    const committedInput = ref<string>(initialCmd);
    const activeTab = ref<"terminal" | "code">("terminal");
    const isFocused = ref(false);
    const inputScrollLeft = ref(0);
    const inputEl = ref<HTMLInputElement | null>(null);
    const compMenuEl = ref<HTMLElement | null>(null);
    const promptWidgetEl = ref<HTMLElement | null>(null);
    const promptInputEl = ref<HTMLInputElement | null>(null);
    const history = ref<string[]>(scenario.value.presets.map((p) => p.cmd));
    const historyCursor = ref(-1);
    const menuOpen = ref(false);
    const activeCompIdx = ref(0);

    const exitCode = ref<number | null>(0);
    const isRunning = ref(false);
    const hasInteracted = ref(false);
    const blocks = ref<readonly TerminalBlock[]>([]);
    const spinnerText = ref<string | null>(null);
    const spinnerFrameIdx = ref(0);
    const activePrompt = ref<ActivePrompt | null>(null);
    const promptSelectIdx = ref(0);
    const promptConfirmVal = ref(true);
    const promptTextVal = ref("");

    // Manual spinner interactive state
    const manualLines = ref<string[]>([]);
    const manualSpinning = ref(false);
    const manualMsgIdx = ref(0);

    let runSeq = 0;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let spinnerTimer: ReturnType<typeof setInterval> | undefined;
    let activeController: AbortController | null = null;

    const prefersReducedMotion = (): boolean =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

    watch([menuOpen, activeCompIdx], ([open, idx]) => {
      if (!open) {
        return;
      }
      void nextTick(() => {
        const activeEl =
          compMenuEl.value?.querySelectorAll<HTMLElement>(".pg-comp-item")[idx];
        activeEl?.scrollIntoView({ block: "nearest" });
      });
    });

    watch(activePrompt, (next) => {
      if (!next) {
        return;
      }
      if (next.kind === "select") {
        promptSelectIdx.value = 0;
      } else if (next.kind === "confirm") {
        promptConfirmVal.value = next.initialValue !== false;
      } else if (next.kind === "text") {
        promptTextVal.value =
          typeof next.initialValue === "string" ? next.initialValue : "";
      }
      if (hasInteracted.value) {
        void nextTick(() => {
          if (next.kind === "text") {
            promptInputEl.value?.focus({ preventScroll: true });
          } else {
            promptWidgetEl.value?.focus({ preventScroll: true });
          }
        });
      }
    });

    function runManualAction(
      action: "start" | "message" | "stop" | "cancel" | "error",
    ): void {
      const spec = scenario.value.manualSpinner;
      if (!spec) {
        return;
      }
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

      if (scenario.value.live) {
        const controller = new AbortController();
        activeController = controller;
        isRunning.value = true;
        exitCode.value = null;
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

      isRunning.value = false;
      const result = await runScenarioCli(scenario.value, raw);
      if (seq === runSeq) {
        exitCode.value = result.exitCode;
        blocks.value = result.blocks;
      }
    }

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
      spinnerText.value = null;
      activePrompt.value = null;
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
      if (activeController) {
        activeController.abort();
      }
    });

    function setImmediateCommand(next: string, pushHistory = false): void {
      if (debounceTimer !== undefined) {
        clearTimeout(debounceTimer);
        debounceTimer = undefined;
      }
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

    const completionQuery = ref<CompletionQueryResult>({
      prefix: "",
      items: [],
    });
    let compSeq = 0;

    async function refreshCompletions(
      raw = commandInput.value,
    ): Promise<CompletionQueryResult> {
      const seq = ++compSeq;
      const result = await resolvePlaygroundCompletions(
        model.value,
        raw,
        scenario.value.env,
      );
      if (seq === compSeq) {
        completionQuery.value = result;
        if (activeCompIdx.value >= result.items.length) {
          activeCompIdx.value = 0;
        }
        if (menuOpen.value && result.items.length === 0) {
          menuOpen.value = false;
        }
      }

      return result;
    }

    if (!import.meta.env.SSR) {
      watch(
        [model, commandInput],
        ([, raw]) => {
          void refreshCompletions(raw);
        },
        { immediate: true },
      );
    }

    const ghostSuffix = computed(() =>
      isFocused.value && !menuOpen.value && inputScrollLeft.value === 0
        ? computeGhostSuffix(commandInput.value, completionQuery.value)
        : "",
    );

    function applyCompletion(entry: CompletionEntry): void {
      const raw = commandInput.value;
      const prefixLen = completionQuery.value.prefix.length;
      const base = prefixLen > 0 ? raw.slice(0, raw.length - prefixLen) : raw;
      const next = base + entry.insert;
      menuOpen.value = false;
      activeCompIdx.value = 0;
      setImmediateCommand(next);
      inputEl.value?.focus();
    }

    function longestCommonPrefix(values: readonly string[]): string {
      if (values.length === 0) {
        return "";
      }
      let out = values[0];
      for (const val of values.slice(1)) {
        let i = 0;
        while (i < out.length && i < val.length && out[i] === val[i]) {
          i++;
        }
        out = out.slice(0, i);
        if (out.length === 0) {
          break;
        }
      }

      return out;
    }

    function triggerTabCompletion(reverse = false): boolean {
      const { prefix, items } = completionQuery.value;
      if (items.length === 0) {
        menuOpen.value = false;

        return false;
      }

      if (menuOpen.value) {
        const delta = reverse ? -1 : 1;
        activeCompIdx.value =
          (activeCompIdx.value + delta + items.length) % items.length;

        return true;
      }

      if (items.length === 1) {
        const only = items[0];
        const raw = commandInput.value;
        const base =
          prefix.length > 0 ? raw.slice(0, raw.length - prefix.length) : raw;
        const next = base + only.insert;
        setImmediateCommand(next);
        if (only.value === prefix) {
          void refreshCompletions(next).then((nextQuery) => {
            if (nextQuery.items.length > 0) {
              menuOpen.value = true;
              activeCompIdx.value = 0;
            }
          });
        }

        return true;
      }

      const lcp = longestCommonPrefix(items.map((item) => item.value));
      if (prefix.length > 0 && lcp.length > prefix.length) {
        const raw = commandInput.value;
        const base =
          prefix.length > 0 ? raw.slice(0, raw.length - prefix.length) : raw;
        setImmediateCommand(base + lcp);
      }
      menuOpen.value = true;
      activeCompIdx.value = 0;

      return true;
    }

    function moveCompletion(delta: number): boolean {
      const len = completionQuery.value.items.length;
      if (len === 0) {
        menuOpen.value = false;

        return false;
      }
      if (!menuOpen.value) {
        menuOpen.value = true;
        activeCompIdx.value = delta < 0 ? len - 1 : 0;

        return true;
      }
      activeCompIdx.value = (activeCompIdx.value + delta + len) % len;

      return true;
    }

    function acceptCompletionOrGhost(): boolean {
      if (menuOpen.value) {
        const item = completionQuery.value.items[activeCompIdx.value];
        if (item) {
          applyCompletion(item);

          return true;
        }
      }
      if (ghostSuffix.value.length > 0) {
        setImmediateCommand(commandInput.value + ghostSuffix.value);

        return true;
      }

      return false;
    }

    function handleKeydown(e: KeyboardEvent): void {
      const ctrl = e.ctrlKey && !e.metaKey && !e.altKey;
      const alt = e.altKey && !e.ctrlKey && !e.metaKey;
      const lowerKey = e.key.toLowerCase();

      if (ctrl && (e.key === " " || e.code === "Space")) {
        e.preventDefault();
        e.stopPropagation();
        triggerTabCompletion(false);

        return;
      }

      if ((ctrl || alt) && (lowerKey === "n" || lowerKey === "j")) {
        if (moveCompletion(1)) {
          e.preventDefault();
          e.stopPropagation();
        }

        return;
      }

      if ((ctrl || alt) && (lowerKey === "p" || lowerKey === "k")) {
        if (moveCompletion(-1)) {
          e.preventDefault();
          e.stopPropagation();
        }

        return;
      }

      if (ctrl && lowerKey === "y") {
        if (acceptCompletionOrGhost()) {
          e.preventDefault();
        }

        return;
      }

      if (ctrl && lowerKey === "e") {
        if (menuOpen.value) {
          e.preventDefault();
          menuOpen.value = false;

          return;
        }
        const el = inputEl.value;
        if (
          el?.selectionStart === commandInput.value.length &&
          ghostSuffix.value.length > 0
        ) {
          e.preventDefault();
          setImmediateCommand(commandInput.value + ghostSuffix.value);
        }

        return;
      }

      if (ctrl && lowerKey === "w") {
        e.preventDefault();
        const el = inputEl.value;
        const pos = el?.selectionStart ?? commandInput.value.length;
        const end = el?.selectionEnd ?? pos;
        const before = commandInput.value.slice(0, pos);
        const after = commandInput.value.slice(end);
        const nextBefore = before.replace(/\S+\s*$|\s+$/, "");
        menuOpen.value = false;
        setImmediateCommand(nextBefore + after);
        void nextTick(() => {
          el?.setSelectionRange(nextBefore.length, nextBefore.length);
        });

        return;
      }

      if (ctrl && lowerKey === "u") {
        e.preventDefault();
        const el = inputEl.value;
        const pos = el?.selectionStart ?? commandInput.value.length;
        const after = commandInput.value.slice(pos);
        menuOpen.value = false;
        setImmediateCommand(after);
        void nextTick(() => {
          el?.setSelectionRange(0, 0);
        });

        return;
      }

      if (
        e.key === "ArrowRight" &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !menuOpen.value &&
        ghostSuffix.value.length > 0
      ) {
        const el = inputEl.value;
        if (
          el?.selectionStart === commandInput.value.length &&
          el.selectionEnd === commandInput.value.length
        ) {
          e.preventDefault();
          setImmediateCommand(commandInput.value + ghostSuffix.value);

          return;
        }
      }

      if (e.key === "Tab") {
        if (e.shiftKey && !menuOpen.value) {
          return;
        }
        if (triggerTabCompletion(e.shiftKey)) {
          e.preventDefault();
        }

        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (menuOpen.value) {
          const item = completionQuery.value.items[activeCompIdx.value];
          if (item) {
            applyCompletion(item);

            return;
          }
        }
        menuOpen.value = false;
        setImmediateCommand(commandInput.value, true);

        return;
      }
      if (e.key === "Escape" || (ctrl && e.key === "[")) {
        if (menuOpen.value) {
          e.preventDefault();
          menuOpen.value = false;

          return;
        }
        if (commandInput.value.length > 0) {
          e.preventDefault();
          setImmediateCommand("");
        }

        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (menuOpen.value) {
          moveCompletion(-1);

          return;
        }
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
      if (e.key === "ArrowDown") {
        if (menuOpen.value) {
          e.preventDefault();
          moveCompletion(1);

          return;
        }
        if (historyCursor.value !== -1) {
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
    }

    function renderPromptWidget(prompt: ActivePrompt, isZh: boolean) {
      if (prompt.kind === "select") {
        const opts = prompt.options ?? [];

        return h(
          "div",
          {
            "ref": promptWidgetEl,
            "class": "pg-pwidget",
            "tabindex": 0,
            "role": "radiogroup",
            "aria-label": prompt.message,
            "onKeydown": (e: KeyboardEvent) => {
              const ctrl = e.ctrlKey && !e.metaKey && !e.altKey;
              const k = e.key.toLowerCase();
              if (
                e.key === "ArrowDown" ||
                e.key === "ArrowRight" ||
                k === "j" ||
                (ctrl && k === "n")
              ) {
                e.preventDefault();
                e.stopPropagation();
                promptSelectIdx.value =
                  (promptSelectIdx.value + 1) % opts.length;
              } else if (
                e.key === "ArrowUp" ||
                e.key === "ArrowLeft" ||
                k === "k" ||
                (ctrl && k === "p")
              ) {
                e.preventDefault();
                e.stopPropagation();
                promptSelectIdx.value =
                  (promptSelectIdx.value - 1 + opts.length) % opts.length;
              } else if (
                e.key === "Enter" ||
                e.key === " " ||
                (ctrl && k === "y")
              ) {
                e.preventDefault();
                const picked = opts[promptSelectIdx.value];
                if (picked) {
                  hasInteracted.value = true;
                  prompt.submit(picked.value);
                }
              } else if (
                e.key === "Escape" ||
                k === "q" ||
                (ctrl && (e.key === "[" || k === "c"))
              ) {
                e.preventDefault();
                prompt.cancel();
              }
            },
          },
          [
            h("div", { class: "pg-pwidget-head" }, [
              h("span", { class: "t-cyan" }, "◆"),
              h("span", { class: "t-bold" }, `  ${prompt.message}`),
              h(
                "button",
                {
                  type: "button",
                  class: "pg-pwidget-cancel",
                  onClick: () => prompt.cancel(),
                },
                isZh ? "Esc 取消" : "Esc cancel",
              ),
            ]),
            h(
              "div",
              { class: "pg-pwidget-opts" },
              opts.map((opt, idx) =>
                h(
                  "button",
                  {
                    "key": opt.value,
                    "type": "button",
                    "role": "radio",
                    "aria-checked": idx === promptSelectIdx.value,
                    "class": [
                      "pg-pwidget-opt",
                      { active: idx === promptSelectIdx.value },
                    ],
                    "onMouseenter": () => {
                      promptSelectIdx.value = idx;
                    },
                    "onClick": () => {
                      hasInteracted.value = true;
                      prompt.submit(opt.value);
                    },
                  },
                  [
                    h("span", { class: "t-faint" }, "│  "),
                    h(
                      "span",
                      {
                        class:
                          idx === promptSelectIdx.value ? "t-green" : "t-faint",
                      },
                      idx === promptSelectIdx.value ? "●" : "○",
                    ),
                    h("span", { class: "pg-pwidget-label" }, ` ${opt.label}`),
                    opt.hint
                      ? h("span", { class: "t-muted" }, ` (${opt.hint})`)
                      : null,
                  ],
                ),
              ),
            ),
          ],
        );
      }

      if (prompt.kind === "confirm") {
        return h(
          "div",
          {
            "ref": promptWidgetEl,
            "class": "pg-pwidget",
            "tabindex": 0,
            "role": "radiogroup",
            "aria-label": prompt.message,
            "onKeydown": (e: KeyboardEvent) => {
              const ctrl = e.ctrlKey && !e.metaKey && !e.altKey;
              const k = e.key.toLowerCase();
              if (
                e.key === "ArrowLeft" ||
                e.key === "ArrowRight" ||
                k === "h" ||
                k === "l" ||
                k === "j" ||
                k === "k" ||
                (ctrl && (k === "n" || k === "p"))
              ) {
                e.preventDefault();
                promptConfirmVal.value = !promptConfirmVal.value;
              } else if (ctrl && k === "y") {
                e.preventDefault();
                hasInteracted.value = true;
                prompt.submit(promptConfirmVal.value);
              } else if (k === "y") {
                e.preventDefault();
                hasInteracted.value = true;
                prompt.submit(true);
              } else if (k === "n") {
                e.preventDefault();
                hasInteracted.value = true;
                prompt.submit(false);
              } else if (e.key === "Enter") {
                e.preventDefault();
                hasInteracted.value = true;
                prompt.submit(promptConfirmVal.value);
              } else if (
                e.key === "Escape" ||
                (ctrl && (e.key === "[" || k === "c"))
              ) {
                e.preventDefault();
                prompt.cancel();
              }
            },
          },
          [
            h("div", { class: "pg-pwidget-head" }, [
              h("span", { class: "t-cyan" }, "◆"),
              h("span", { class: "t-bold" }, `  ${prompt.message}`),
              h(
                "button",
                {
                  type: "button",
                  class: "pg-pwidget-cancel",
                  onClick: () => prompt.cancel(),
                },
                isZh ? "Esc 取消" : "Esc cancel",
              ),
            ]),
            h("div", { class: "pg-pwidget-confirm" }, [
              h("span", { class: "t-faint" }, "│  "),
              h(
                "button",
                {
                  "type": "button",
                  "role": "radio",
                  "aria-checked": promptConfirmVal.value,
                  "class": [
                    "pg-pwidget-choice",
                    { active: promptConfirmVal.value },
                  ],
                  "onMouseenter": () => {
                    promptConfirmVal.value = true;
                  },
                  "onClick": () => prompt.submit(true),
                },
                [
                  h(
                    "span",
                    { class: promptConfirmVal.value ? "t-green" : "t-faint" },
                    promptConfirmVal.value ? "●" : "○",
                  ),
                  " Yes",
                ],
              ),
              h("span", { class: "t-faint" }, " / "),
              h(
                "button",
                {
                  "type": "button",
                  "role": "radio",
                  "aria-checked": !promptConfirmVal.value,
                  "class": [
                    "pg-pwidget-choice",
                    { active: !promptConfirmVal.value },
                  ],
                  "onMouseenter": () => {
                    promptConfirmVal.value = false;
                  },
                  "onClick": () => prompt.submit(false),
                },
                [
                  h(
                    "span",
                    { class: promptConfirmVal.value ? "t-faint" : "t-green" },
                    promptConfirmVal.value ? "○" : "●",
                  ),
                  " No",
                ],
              ),
            ]),
          ],
        );
      }

      return h("div", { class: "pg-pwidget" }, [
        h("div", { class: "pg-pwidget-head" }, [
          h("span", { class: "t-cyan" }, "◆"),
          h("span", { class: "t-bold" }, `  ${prompt.message}`),
          h(
            "button",
            {
              type: "button",
              class: "pg-pwidget-cancel",
              onClick: () => prompt.cancel(),
            },
            isZh ? "Esc 取消" : "Esc cancel",
          ),
        ]),
        h("div", { class: "pg-pwidget-textrow" }, [
          h("span", { class: "t-faint" }, "│  "),
          h("input", {
            ref: promptInputEl,
            type: "text",
            class: "pg-pwidget-input",
            value: promptTextVal.value,
            placeholder: prompt.placeholder ?? "",
            onInput: (e: Event) => {
              promptTextVal.value = (e.target as HTMLInputElement).value;
            },
            onKeydown: (e: KeyboardEvent) => {
              if (e.key === "Enter") {
                e.preventDefault();
                prompt.submit(promptTextVal.value);
              } else if (e.key === "Escape") {
                e.preventDefault();
                prompt.cancel();
              }
            },
          }),
          h(
            "button",
            {
              type: "button",
              class: "pg-pwidget-submit",
              onClick: () => prompt.submit(promptTextVal.value),
            },
            "Enter ↵",
          ),
        ]),
      ]);
    }

    return () => {
      const isZh = props.lang === "zh";
      const isSplit = props.variant === "split";
      const isInline = props.variant === "inline";
      const isManual = Boolean(scenario.value.manualSpinner);

      const exitBadge =
        exitCode.value === null
          ? h("span", { class: "pg-exit running" }, isZh ? "运行中" : "running")
          : h(
              "span",
              {
                class: ["pg-exit", exitCode.value === 0 ? "ok" : "err"],
              },
              `exit ${exitCode.value}`,
            );

      const replayButton =
        scenario.value.live && !isManual
          ? h(
              "button",
              {
                "type": "button",
                "class": "pg-replay",
                "title": isZh ? "重新运行" : "Replay",
                "aria-label": isZh ? "重新运行" : "Replay",
                "onClick": () => {
                  hasInteracted.value = true;
                  void executeNow(commandInput.value);
                },
              },
              isZh ? "↻ 重播" : "↻ Replay",
            )
          : null;

      const codePane = h("div", { class: "pg-pane pg-pane-code" }, [
        h("div", { class: "pg-bar" }, [
          h("span", { class: "pg-filename" }, "cli.ts"),
        ]),
        h("pre", { class: "pg-code" }, [h("code", highlightedCode.value)]),
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
            h(
              "button",
              {
                type: "button",
                class: "pg-preset",
                disabled: !manualSpinning.value,
                onClick: () => runManualAction("message"),
              },
              "s.message()",
            ),
            h(
              "button",
              {
                type: "button",
                class: "pg-preset",
                disabled: !manualSpinning.value,
                onClick: () => runManualAction("stop"),
              },
              "s.stop()",
            ),
            h(
              "button",
              {
                type: "button",
                class: "pg-preset",
                disabled: !manualSpinning.value,
                onClick: () => runManualAction("cancel"),
              },
              "s.cancel()",
            ),
            h(
              "button",
              {
                type: "button",
                class: "pg-preset",
                disabled: !manualSpinning.value,
                onClick: () => runManualAction("error"),
              },
              "s.error()",
            ),
            h("span", { class: "pg-manual-spacer" }),
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
                  "aria-expanded":
                    menuOpen.value && completionQuery.value.items.length > 0,
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
              isFocused.value && completionQuery.value.items.length > 0
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
        outputNodes.push(renderPromptWidget(activePrompt.value, isZh));
      }

      const terminalBody = h("div", { class: "pg-terminal-body" }, [
        manualBar,
        promptBar,
        presetsBar,
        h(
          "div",
          { "class": "pg-output", "role": "region", "aria-live": "polite" },
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
              h("div", { class: "pg-bar-right" }, [replayButton, exitBadge]),
            ]),
        !isInline && hasCodeTab.value && activeTab.value === "code"
          ? h("pre", { class: "pg-code pg-code-tabbed" }, [
              h("code", highlightedCode.value),
            ])
          : terminalBody,
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
