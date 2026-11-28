import type { Component, PropType } from "vue";
import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";

import type { PlaygroundScenario } from "./playground-runtime.ts";

export type LazyPlaygroundScenario =
  PlaygroundScenario | (() => Promise<PlaygroundScenario>);

let cachedViewPromise: Promise<Component> | null = null;

function loadPlaygroundView(): Promise<Component> {
  cachedViewPromise ??= import("./CliPlaygroundView.ts").then(
    (mod) => mod.CliPlaygroundView,
  );

  return cachedViewPromise;
}

const CODE_SKELETON_LINES: readonly {
  readonly indent: number;
  readonly widths: readonly [number, number?];
  readonly accent?: boolean;
}[] = [
  { indent: 0, widths: [14, 42], accent: true },
  { indent: 0, widths: [0] },
  { indent: 0, widths: [18, 28], accent: true },
  { indent: 1, widths: [22, 18] },
  { indent: 1, widths: [16, 36] },
  { indent: 2, widths: [26, 20] },
  { indent: 2, widths: [34] },
  { indent: 1, widths: [14, 24] },
  { indent: 0, widths: [10] },
];

const renderMatrixLoader = () =>
  h("span", { "class": "pg-matrix", "aria-hidden": "true" }, [
    h("span", { class: "pg-matrix-dot d1" }),
    h("span", { class: "pg-matrix-dot d2" }),
    h("span", { class: "pg-matrix-dot d3" }),
    h("span", { class: "pg-matrix-dot d4" }),
  ]);

const renderCodeSkeleton = () =>
  h(
    "div",
    { "class": "pg-code-skel", "aria-hidden": "true" },
    CODE_SKELETON_LINES.map((line, idx) =>
      line.widths[0] === 0
        ? h("div", { key: idx, class: "pg-skel-gap" })
        : h(
            "div",
            {
              key: idx,
              class: "pg-skel-row",
              style: {
                paddingLeft: `${line.indent * 16}px`,
                animationDelay: `${idx * 55}ms`,
              },
            },
            [
              h("span", {
                class: ["pg-skel-bar", { accent: line.accent }],
                style: { width: `${line.widths[0]}%` },
              }),
              line.widths[1]
                ? h("span", {
                    class: "pg-skel-bar subtle",
                    style: { width: `${line.widths[1]}%` },
                  })
                : null,
            ],
          ),
    ),
  );

export const CliPlayground = defineComponent({
  name: "CliPlayground",
  props: {
    lang: {
      type: String as PropType<"en" | "zh">,
      default: "en",
    },
    scenario: {
      type: [Object, Function] as PropType<LazyPlaygroundScenario>,
      required: true,
    },
    variant: {
      type: String as PropType<"inline" | "compact" | "split">,
      default: "inline",
    },
  },
  setup(props) {
    const rootEl = ref<HTMLElement | null>(null);
    const status = ref<"idle" | "loading" | "ready" | "error">("idle");
    const viewComponent = shallowRef<Component | null>(null);
    const resolvedScenario = shallowRef<PlaygroundScenario | null>(null);

    let observer: IntersectionObserver | null = null;
    let loadSeq = 0;

    async function load(): Promise<void> {
      const seq = ++loadSeq;
      status.value = "loading";
      try {
        const scenarioPromise =
          typeof props.scenario === "function"
            ? props.scenario()
            : Promise.resolve(props.scenario);
        const [view, scenario] = await Promise.all([
          loadPlaygroundView(),
          scenarioPromise,
        ]);
        if (seq !== loadSeq) {
          return;
        }
        viewComponent.value = view;
        resolvedScenario.value = scenario;
        status.value = "ready";
      } catch {
        if (seq === loadSeq) {
          status.value = "error";
        }
      }
    }

    function disconnectObserver(): void {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    }

    onMounted(() => {
      const el = rootEl.value;
      if (!el || typeof IntersectionObserver === "undefined") {
        void load();

        return;
      }
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            disconnectObserver();
            void load();
          }
        },
        { rootMargin: "240px 0px" },
      );
      observer.observe(el);
    });

    watch(
      () => props.scenario,
      () => {
        if (status.value !== "idle") {
          void load();
        }
      },
    );

    onBeforeUnmount(() => {
      disconnectObserver();
    });

    return () => {
      if (
        status.value === "ready" &&
        viewComponent.value &&
        resolvedScenario.value
      ) {
        return h(viewComponent.value, {
          lang: props.lang,
          scenario: resolvedScenario.value,
          variant: props.variant,
        });
      }

      const isZh = props.lang === "zh";
      const isSplit = props.variant === "split";
      const isInline = props.variant === "inline";
      const isError = status.value === "error";

      const statusBadge = isError
        ? h("span", { class: "pg-exit err" }, isZh ? "加载失败" : "error")
        : h("span", { class: "pg-exit running" }, [
            h("span", { "class": "pg-live-dot", "aria-hidden": "true" }),
            isZh ? "加载中" : "loading",
          ]);

      const bodyContent = isError
        ? h("div", { class: "pg-load-error" }, [
            h(
              "span",
              { class: "pg-load-error-text" },
              isZh ? "交互终端加载失败。" : "Failed to load playground.",
            ),
            h(
              "button",
              {
                type: "button",
                class: "pg-retry",
                onClick: () => {
                  disconnectObserver();
                  void load();
                },
              },
              isZh ? "重试" : "Retry",
            ),
          ])
        : h(
            "div",
            {
              "class": "pg-loading-stage",
              "role": "status",
              "aria-live": "polite",
            },
            [
              h("div", { class: "pg-loading-head" }, [
                renderMatrixLoader(),
                h(
                  "span",
                  { class: "pg-loading-label" },
                  isZh ? "正在初始化终端" : "Initializing terminal",
                ),
              ]),
              h("div", { "class": "pg-loading-trace", "aria-hidden": "true" }, [
                h("div", { class: "pg-trace-line" }, [
                  h("span", { class: "pg-trace-rail" }, "│"),
                  h("span", {
                    class: "pg-skel-bar",
                    style: { width: "44%" },
                  }),
                ]),
                h("div", { class: "pg-trace-line" }, [
                  h("span", { class: "pg-trace-rail" }, "│"),
                  h("span", {
                    class: "pg-skel-bar subtle",
                    style: { width: "28%" },
                  }),
                ]),
              ]),
            ],
          );

      const codeSkeleton = h("div", { class: "pg-pane pg-pane-code" }, [
        h("div", { class: "pg-bar" }, [
          h("span", { class: "pg-filename" }, "cli.ts"),
        ]),
        h("div", { class: "pg-code pg-code-loading" }, [renderCodeSkeleton()]),
      ]);

      const termSkeleton = h("div", { class: "pg-pane pg-pane-term" }, [
        isInline
          ? null
          : h("div", { class: "pg-bar" }, [
              h(
                "span",
                { class: "pg-filename" },
                isZh ? "交互终端" : "Terminal",
              ),
              h("div", { class: "pg-bar-right" }, [statusBadge]),
            ]),
        h("div", { class: "pg-terminal-body" }, [
          h("div", { class: "pg-prompt-box" }, [
            h("div", { class: "pg-prompt pg-prompt-placeholder" }, [
              h("span", { "class": "pg-dollar", "aria-hidden": "true" }, "$"),
              h(
                "span",
                { "class": "pg-placeholder-cmd", "aria-hidden": "true" },
                [
                  h("span", { class: "pg-skel-cmd" }),
                  h("span", { class: "pg-cursor" }),
                ],
              ),
              isInline ? statusBadge : null,
            ]),
            isError
              ? null
              : h("span", {
                  "class": "pg-progress-beam",
                  "aria-hidden": "true",
                }),
          ]),
          h("div", { class: "pg-output" }, [bodyContent]),
        ]),
      ]);

      return h(
        "section",
        {
          "ref": rootEl,
          "class": [
            "pg-workbench",
            "is-lazy-shell",
            isSplit ? "is-split" : isInline ? "is-inline" : "is-compact",
          ],
          "aria-label": isZh ? "交互式终端演示" : "Interactive CLI playground",
          "aria-busy": !isError,
        },
        isSplit ? [codeSkeleton, termSkeleton] : [termSkeleton],
      );
    };
  },
});
