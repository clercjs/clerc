import type { PropType } from "vue";
import { defineComponent, h, nextTick, ref, watch } from "vue";

import type { ActivePrompt } from "./runtime.ts";

export const PromptWidget = defineComponent({
  name: "PromptWidget",
  props: {
    prompt: {
      type: Object as PropType<ActivePrompt>,
      required: true,
    },
    isZh: {
      type: Boolean,
      required: true,
    },
    autoFocus: {
      type: Boolean,
      default: false,
    },
  },
  emits: {
    interact: () => true,
  },
  setup(props, { emit }) {
    const widgetEl = ref<HTMLElement | null>(null);
    const inputEl = ref<HTMLInputElement | null>(null);
    const selectIdx = ref(0);
    const confirmVal = ref(true);
    const textVal = ref("");

    watch(
      () => props.prompt,
      (next) => {
        if (next.kind === "select") {
          selectIdx.value = 0;
        } else if (next.kind === "confirm") {
          confirmVal.value = next.initialValue !== false;
        } else {
          textVal.value =
            typeof next.initialValue === "string" ? next.initialValue : "";
        }
        if (props.autoFocus) {
          void nextTick(() => {
            if (next.kind === "text") {
              inputEl.value?.focus({ preventScroll: true });
            } else {
              widgetEl.value?.focus({ preventScroll: true });
            }
          });
        }
      },
      { immediate: true },
    );

    return () => {
      const { prompt, isZh } = props;

      const header = h("div", { class: "pg-pwidget-head" }, [
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
      ]);

      if (prompt.kind === "select") {
        const opts = prompt.options ?? [];

        return h(
          "div",
          {
            "ref": widgetEl,
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
                selectIdx.value = (selectIdx.value + 1) % opts.length;
              } else if (
                e.key === "ArrowUp" ||
                e.key === "ArrowLeft" ||
                k === "k" ||
                (ctrl && k === "p")
              ) {
                e.preventDefault();
                e.stopPropagation();
                selectIdx.value =
                  (selectIdx.value - 1 + opts.length) % opts.length;
              } else if (
                e.key === "Enter" ||
                e.key === " " ||
                (ctrl && k === "y")
              ) {
                e.preventDefault();
                const picked = opts[selectIdx.value];
                if (picked) {
                  emit("interact");
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
            header,
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
                    "aria-checked": idx === selectIdx.value,
                    "class": [
                      "pg-pwidget-opt",
                      { active: idx === selectIdx.value },
                    ],
                    "onMouseenter": () => {
                      selectIdx.value = idx;
                    },
                    "onClick": () => {
                      emit("interact");
                      prompt.submit(opt.value);
                    },
                  },
                  [
                    h("span", { class: "t-faint" }, "│  "),
                    h(
                      "span",
                      {
                        class: idx === selectIdx.value ? "t-green" : "t-faint",
                      },
                      idx === selectIdx.value ? "●" : "○",
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
            "ref": widgetEl,
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
                confirmVal.value = !confirmVal.value;
              } else if (ctrl && k === "y") {
                e.preventDefault();
                emit("interact");
                prompt.submit(confirmVal.value);
              } else if (k === "y") {
                e.preventDefault();
                emit("interact");
                prompt.submit(true);
              } else if (k === "n") {
                e.preventDefault();
                emit("interact");
                prompt.submit(false);
              } else if (e.key === "Enter") {
                e.preventDefault();
                emit("interact");
                prompt.submit(confirmVal.value);
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
            header,
            h("div", { class: "pg-pwidget-confirm" }, [
              h("span", { class: "t-faint" }, "│  "),
              h(
                "button",
                {
                  "type": "button",
                  "role": "radio",
                  "aria-checked": confirmVal.value,
                  "class": ["pg-pwidget-choice", { active: confirmVal.value }],
                  "onMouseenter": () => {
                    confirmVal.value = true;
                  },
                  "onClick": () => prompt.submit(true),
                },
                [
                  h(
                    "span",
                    { class: confirmVal.value ? "t-green" : "t-faint" },
                    confirmVal.value ? "●" : "○",
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
                  "aria-checked": !confirmVal.value,
                  "class": ["pg-pwidget-choice", { active: !confirmVal.value }],
                  "onMouseenter": () => {
                    confirmVal.value = false;
                  },
                  "onClick": () => prompt.submit(false),
                },
                [
                  h(
                    "span",
                    { class: confirmVal.value ? "t-faint" : "t-green" },
                    confirmVal.value ? "○" : "●",
                  ),
                  " No",
                ],
              ),
            ]),
          ],
        );
      }

      return h("div", { class: "pg-pwidget" }, [
        header,
        h("div", { class: "pg-pwidget-textrow" }, [
          h("span", { class: "t-faint" }, "│  "),
          h("input", {
            ref: inputEl,
            type: "text",
            class: "pg-pwidget-input",
            value: textVal.value,
            placeholder: prompt.placeholder ?? "",
            onInput: (e: Event) => {
              textVal.value = (e.target as HTMLInputElement).value;
            },
            onKeydown: (e: KeyboardEvent) => {
              if (e.key === "Enter") {
                e.preventDefault();
                prompt.submit(textVal.value);
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
              onClick: () => prompt.submit(textVal.value),
            },
            "Enter ↵",
          ),
        ]),
      ]);
    };
  },
});
