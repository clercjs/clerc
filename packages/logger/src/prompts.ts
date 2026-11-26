import type { CommonOptions } from "@clack/prompts";
import * as clack from "@clack/prompts";

export type {
  AutocompleteMultiSelectOptions,
  AutocompleteOptions,
  BoxAlignment,
  BoxOptions,
  ClackSettings,
  CommonOptions,
  ConfirmOptions,
  DateFormat,
  DateOptions,
  GroupMultiSelectOptions,
  LimitOptionsParams,
  LogMessageOptions,
  MultiLineOptions,
  MultiSelectOptions,
  NoteOptions,
  Option,
  PasswordOptions,
  PathOptions,
  ProgressOptions,
  ProgressResult,
  PromptGroup,
  PromptGroupAwaitedReturn,
  PromptGroupOptions,
  SelectKeyOptions,
  SelectOptions,
  SpinnerOptions,
  SpinnerResult,
  Task,
  TaskLogCompletionOptions,
  TaskLogMessageOptions,
  TaskLogOptions,
  TextOptions,
} from "@clack/prompts";
export {
  CANCEL_SYMBOL,
  MULTISELECT_INSTRUCTIONS,
  SELECT_INSTRUCTIONS,
  S_BAR,
  S_BAR_END,
  S_BAR_END_RIGHT,
  S_BAR_H,
  S_BAR_START,
  S_BAR_START_RIGHT,
  S_CHECKBOX_ACTIVE,
  S_CHECKBOX_INACTIVE,
  S_CHECKBOX_SELECTED,
  S_CONNECT_LEFT,
  S_CORNER_BOTTOM_LEFT,
  S_CORNER_BOTTOM_RIGHT,
  S_CORNER_TOP_LEFT,
  S_CORNER_TOP_RIGHT,
  S_ERROR,
  S_INFO,
  S_PASSWORD_MASK,
  S_RADIO_ACTIVE,
  S_RADIO_INACTIVE,
  S_STEP_ACTIVE,
  S_STEP_CANCEL,
  S_STEP_ERROR,
  S_STEP_SUBMIT,
  S_SUCCESS,
  S_WARN,
  box,
  cancel,
  formatInstructionFooter,
  group,
  intro,
  isCI,
  isCancel,
  isTTY,
  limitOptions,
  log,
  note,
  outro,
  progress,
  settings,
  spinner,
  stream,
  symbol,
  symbolBar,
  taskLog,
  tasks,
  unicode,
  unicodeOr,
  updateSettings,
} from "@clack/prompts";

function assertInteractiveTty(opts?: CommonOptions): void {
  if (
    (!opts?.input && !process.stdin.isTTY) ||
    (!opts?.output && !process.stdout.isTTY)
  ) {
    throw new Error(
      "Interactive prompts require a TTY terminal. Pass explicit flags or provide custom input/output streams.",
    );
  }
}

const guardPrompt = <Fn extends (opts: any) => Promise<any>>(fn: Fn): Fn =>
  (async (opts: CommonOptions) => {
    assertInteractiveTty(opts);

    return fn(opts);
  }) as Fn;

export const autocomplete = guardPrompt(clack.autocomplete);
export const autocompleteMultiselect = guardPrompt(
  clack.autocompleteMultiselect,
);
export const confirm = guardPrompt(clack.confirm);
export const date = guardPrompt(clack.date);
export const groupMultiselect = guardPrompt(clack.groupMultiselect);
export const multiline = guardPrompt(clack.multiline);
export const multiselect = guardPrompt(clack.multiselect);
export const password = guardPrompt(clack.password);
export const path = guardPrompt(clack.path);
export const select = guardPrompt(clack.select);
export const selectKey = guardPrompt(clack.selectKey);
export const text = guardPrompt(clack.text);
