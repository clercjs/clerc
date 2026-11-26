import type {
  CompleteFileOptions,
  CompleteListOptions,
  CompletionItem,
  CompletionSpec,
} from "./types";

type FileSpec = Extract<CompletionSpec, { readonly kind: "file" }>;
type DirSpec = Extract<CompletionSpec, { readonly kind: "dir" }>;
type ListSpec = Extract<CompletionSpec, { readonly kind: "list" }>;

function file(options?: CompleteFileOptions): FileSpec;
function file(...extensions: readonly [string, ...string[]]): FileSpec;
function file(
  first?: string | CompleteFileOptions,
  ...rest: readonly string[]
): FileSpec {
  if (typeof first === "string") {
    return { kind: "file", extensions: [first, ...rest] };
  }

  return first?.extensions && first.extensions.length > 0
    ? { kind: "file", extensions: first.extensions }
    : { kind: "file" };
}

export const Complete = {
  list: (
    items: readonly CompletionItem[],
    options?: CompleteListOptions,
  ): ListSpec => ({
    kind: "list",
    items,
    ...options,
  }),
  file,
  dir: (): DirSpec => ({ kind: "dir" }),
  none: false as const,
} as const;
