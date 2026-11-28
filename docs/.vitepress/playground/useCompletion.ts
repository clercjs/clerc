import type { CliModel } from "clerc";
import type { ComputedRef, Ref } from "vue";
import { computed, nextTick, ref, watch } from "vue";

import type { CompletionEntry, CompletionQueryResult } from "./runtime.ts";
import { computeGhostSuffix, resolvePlaygroundCompletions } from "./runtime.ts";

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

export function useCompletion(options: {
  readonly model: ComputedRef<CliModel>;
  readonly env: ComputedRef<
    Readonly<Record<string, string | undefined>> | undefined
  >;
  readonly commandInput: Ref<string>;
  readonly isFocused: Ref<boolean>;
  readonly inputScrollLeft: Ref<number>;
  readonly inputEl: Ref<HTMLInputElement | null>;
  readonly history: Ref<string[]>;
  readonly historyCursor: Ref<number>;
  readonly setImmediateCommand: (next: string, pushHistory?: boolean) => void;
}) {
  const {
    model,
    env,
    commandInput,
    isFocused,
    inputScrollLeft,
    inputEl,
    history,
    historyCursor,
    setImmediateCommand,
  } = options;

  const menuOpen = ref(false);
  const activeCompIdx = ref(0);
  const compMenuEl = ref<HTMLElement | null>(null);
  const completionQuery = ref<CompletionQueryResult>({ prefix: "", items: [] });
  let compSeq = 0;

  async function refreshCompletions(
    raw = commandInput.value,
  ): Promise<CompletionQueryResult> {
    const seq = ++compSeq;
    const result = await resolvePlaygroundCompletions(
      model.value,
      raw,
      env.value,
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

  const ghostSuffix = computed(() =>
    isFocused.value && !menuOpen.value && inputScrollLeft.value === 0
      ? computeGhostSuffix(commandInput.value, completionQuery.value)
      : "",
  );

  function applyCompletion(entry: CompletionEntry): void {
    const raw = commandInput.value;
    const prefixLen = completionQuery.value.prefix.length;
    const base = prefixLen > 0 ? raw.slice(0, raw.length - prefixLen) : raw;
    menuOpen.value = false;
    activeCompIdx.value = 0;
    setImmediateCommand(base + entry.insert);
    inputEl.value?.focus();
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

  return {
    menuOpen,
    activeCompIdx,
    compMenuEl,
    completionQuery,
    ghostSuffix,
    refreshCompletions,
    applyCompletion,
    triggerTabCompletion,
    handleKeydown,
  };
}
