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
        : h("span", { class: "pg-exit running" }, isZh ? "加载中" : "loading");

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
              "class": "pg-loading",
              "role": "status",
              "aria-live": "polite",
            },
            [
              h("span", {
                "class": "pg-loading-spinner",
                "aria-hidden": "true",
              }),
              h(
                "span",
                { class: "pg-loading-text" },
                isZh ? "正在加载交互终端..." : "Loading playground...",
              ),
            ],
          );

      const codeSkeleton = h("div", { class: "pg-pane pg-pane-code" }, [
        h("div", { class: "pg-bar" }, [
          h("span", { class: "pg-filename" }, "cli.ts"),
        ]),
        h("div", { class: "pg-code pg-code-loading" }, [
          h("div", { class: "pg-loading" }, [
            h("span", {
              "class": "pg-loading-spinner",
              "aria-hidden": "true",
            }),
            h(
              "span",
              { class: "pg-loading-text" },
              isZh ? "正在加载示例源码..." : "Loading source...",
            ),
          ]),
        ]),
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
              h("span", { class: "pg-placeholder-cmd" }, "..."),
              isInline ? statusBadge : null,
            ]),
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
